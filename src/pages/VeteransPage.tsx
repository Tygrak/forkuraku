import { useEffect, useMemo, useRef, useState } from "react";
import "./VeteransPage/VeteransPage.css";
import { Alert, Button, ButtonGroup, Container, Form, InputGroup } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import type { AccountHorseActVerificationStatusResponse, AccountVeteranSnapshotSummary } from "../auth/authShared";
import { Veteran, BaseFilter, BluesFilter, AptitudeFilter, UniquesFilter, RacesFilter, SkillsFilter, SortOption, SortDirection, SparkDisplayMode, getFilterStats, getFilterStarOptions } from "./VeteransPage/types";
import { SelectorType } from "./VeteransPage/InlineFilterSelector";
import VeteransSorter from "./VeteransPage/VeteransSorter";
import CustomScoringPanel from "./VeteransPage/CustomScoringPanel";
import ParentCharacterFilter from "./VeteransPage/ParentCharacterFilter";

import VeteranCard from "./VeteransPage/VeteranCard";
import BestComboPanel from "./VeteransPage/BestComboPanel";
import FilterToolbar from "./VeteransPage/FilterToolbar";
import ActiveFiltersList from "./VeteransPage/ActiveFiltersList";
import OptimizerPanel from "./VeteransPage/OptimizerPanel";
import AffinityCalculatorPanel from "./VeteransPage/AffinityCalculatorPanel";
import RacePlannerModal from "./VeteransPage/RacePlannerModal";
import SparkProcModal from "./VeteransPage/SparkProcModal";
import { applyFiltersAndSort, getAvailableStats } from "./VeteransPage/VeteransLogic";
import {
    calculateCustomScore,
    calculateCustomScoreRanges,
    getSearchHighlightedFactorKeys,
    loadCustomScoringConfig,
    saveCustomScoringConfig,
} from "./VeteransPage/customScoring";
import {
    getKvKeyFromUrl,
    fetchVeteransFromWorker,
    fetchLoanedChara,
    fetchAccountVeterans,
    shouldLoadAccountVeterans,
} from "./VeteransPage/UrlSharing";
import { searchUmaMoeVeterans, UmaMoeSearchFilters, UmaMoeSearchResult } from "./VeteransPage/umaMoeSearch";

const FILTER_CONFIG = {
    blues: { categoryId: 1, stateKey: "bluesFilters" as const, label: "Blues", color: "rgb(55, 183, 244)", selectorType: "blues" as SelectorType },
    aptitude: { categoryId: 2, stateKey: "aptitudeFilters" as const, label: "Aptitude", color: "rgb(255, 118, 178)", selectorType: "aptitude" as SelectorType },
    uniques: { categoryId: 3, stateKey: "uniquesFilters" as const, label: "Uniques", color: "rgb(120, 208, 96)", selectorType: "uniques" as SelectorType },
    races: { categoryId: 4, stateKey: "racesFilters" as const, label: "Races/Scenarios", color: "rgb(200, 162, 200)", selectorType: "races" as SelectorType },
    skills: { categoryId: 5, stateKey: "skillsFilters" as const, label: "Skills", color: "rgb(211, 84, 0)", selectorType: "skills" as SelectorType },
};

export default function VeteransPage() {
    const { authenticated, user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const vetListRef = useRef<HTMLDivElement>(null);

    const [ownedVeterans, setOwnedVeterans] = useState<Veteran[]>([]);
    const [sourceTab, setSourceTab] = useState<"owned" | "moe" | "best">("owned");
    const [moeVeterans, setMoeVeterans] = useState<Veteran[]>([]);
    const [moeSearching, setMoeSearching] = useState(false);
    const [moeError, setMoeError] = useState("");
    const [moeMeta, setMoeMeta] = useState<UmaMoeSearchResult | null>(null);
    const [moeSearchParamsKey, setMoeSearchParamsKey] = useState<string | null>(null);
    const veterans = sourceTab === "moe" ? moeVeterans : ownedVeterans;
    const [error, setError] = useState("");
    const [accountVeteranMeta, setAccountVeteranMeta] = useState<{
        viewerId: number;
        veteranCount: number;
        updatedAt: string;
    } | null>(null);
    const [accountVeteranSnapshot, setAccountVeteranSnapshot] = useState<AccountVeteranSnapshotSummary | null>(null);

    const [affinityParent1, setAffinityParent1] = useState<Veteran | null>(null);
    const [affinityParent2, setAffinityParent2] = useState<Veteran | null>(null);
    const [parent2IsBorrowed, setParent2IsBorrowed] = useState(false);
    const [borrowLoading, setBorrowLoading] = useState(false);
    const [showPlanner, setShowPlanner] = useState(false);
    const [showSparkProc, setShowSparkProc] = useState(false);
    const [activeAffinitySlot, setActiveAffinitySlot] = useState<"p1" | "p2" | null>(null);

    useEffect(() => {
        if (activeAffinitySlot && vetListRef.current) {
            const y = vetListRef.current.getBoundingClientRect().top + window.scrollY - 16;
            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        }
    }, [activeAffinitySlot]);

    const handleLegacySlotClick = (slot: "p1" | "p2") => {
        setActiveAffinitySlot(prev => (prev === slot ? null : slot));
    };

    const handleSelectForSlot = (veteran: Veteran, slot: "p1" | "p2") => {
        if (slot === "p1") {
            setAffinityParent1(veteran);
        } else {
            setAffinityParent2(veteran);
            setParent2IsBorrowed(false);
        }
        setActiveAffinitySlot(null);
        setActiveSort("affinity");
    };

    const handleAffinityReset = () => {
        setAffinityParent1(null);
        setAffinityParent2(null);
        setParent2IsBorrowed(false);
        setActiveAffinitySlot(null);
        setAffinityCharaId(null);
    };

    const handleBorrowLookup = async (viewerId: string) => {
        setBorrowLoading(true);
        try {
            const vet = await fetchLoanedChara(viewerId);
            setAffinityParent2(vet);
            setParent2IsBorrowed(true);
            setActiveSort("affinity");
        } finally {
            setBorrowLoading(false);
        }
    };

    const [bluesFilters, setBluesFilters] = useState<BluesFilter[]>([]);
    const [aptitudeFilters, setAptitudeFilters] = useState<AptitudeFilter[]>([]);
    const [uniquesFilters, setUniquesFilters] = useState<UniquesFilter[]>([]);
    const [racesFilters, setRacesFilters] = useState<RacesFilter[]>([]);
    const [skillsFilters, setSkillsFilters] = useState<SkillsFilter[]>([]);

    const [showBluesSelector, setShowBluesSelector] = useState(false);
    const [showAptitudeSelector, setShowAptitudeSelector] = useState(false);
    const [showUniquesSelector, setShowUniquesSelector] = useState(false);
    const [showRacesSelector, setShowRacesSelector] = useState(false);
    const [showSkillsSelector, setShowSkillsSelector] = useState(false);

    const [activeSort, setActiveSort] = useState<SortOption>("custom");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [sparkDisplayMode, setSparkDisplayMode] = useState<SparkDisplayMode>("separate");
    const [nameSearch, setNameSearch] = useState("");
    const [parentCharaIds, setParentCharaIds] = useState<number[]>([]);
    const [affinityCharaId, setAffinityCharaId] = useState<number | null>(null);
    const [customScoringConfig, setCustomScoringConfig] = useState(loadCustomScoringConfig);

    useEffect(() => {
        saveCustomScoringConfig(customScoringConfig);
    }, [customScoringConfig]);

    const customScoreRanges = useMemo(
        () => calculateCustomScoreRanges(veterans),
        [veterans],
    );

    const customScoreContext = useMemo(
        () => ({
            maxGpAffinity: customScoreRanges.maxGpAffinity,
            maxRaceWins: customScoreRanges.maxRaceWins,
        }),
        [customScoreRanges],
    );

    const searchHighlightedFactorKeys = useMemo(
        () => getSearchHighlightedFactorKeys(customScoringConfig),
        [customScoringConfig],
    );

    const umaMoeSearchFilters = useMemo<UmaMoeSearchFilters>(() => ({
        blues: bluesFilters,
        aptitude: aptitudeFilters,
        uniques: uniquesFilters,
        races: racesFilters,
        skills: skillsFilters,
    }), [bluesFilters, aptitudeFilters, uniquesFilters, racesFilters, skillsFilters]);

    const moeSearchSignature = useMemo(() => JSON.stringify({
        style: customScoringConfig.skillSparkStyle,
        weights: customScoringConfig.skillSparkWeights[customScoringConfig.skillSparkStyle],
        pinkPreset: customScoringConfig.pinkPreset,
        characters: [...parentCharaIds].sort((a, b) => a - b),
        filters: umaMoeSearchFilters,
    }), [
        customScoringConfig.skillSparkStyle,
        customScoringConfig.skillSparkWeights,
        customScoringConfig.pinkPreset,
        parentCharaIds,
        umaMoeSearchFilters,
    ]);

    const moeSearchIsCurrent = !!moeMeta && moeSearchParamsKey === moeSearchSignature;
    const moeCanLoadMore = moeSearchIsCurrent
        && !!moeMeta
        && moeMeta.page + 1 < moeMeta.totalPages;

    const customScores = useMemo(() => {
        if (activeSort !== "custom") return null;

        const scores = new Map<Veteran, number>();
        for (const veteran of veterans) {
            scores.set(veteran, calculateCustomScore(veteran, customScoringConfig, customScoreContext).total);
        }
        return scores;
    }, [veterans, activeSort, customScoringConfig, customScoreContext]);

    const handleCustomScoringChange = (config: typeof customScoringConfig) => {
        setCustomScoringConfig(config);
        setActiveSort("custom");
    };

    useEffect(() => {
        const kvKey = getKvKeyFromUrl();
        if (kvKey) {
            fetchVeteransFromWorker(kvKey)
                .then(v => {
                    setOwnedVeterans(v);
                    setAccountVeteranMeta(null);
                })
                .catch(err => setError(`Failed to load shared roster: ${err.message}`));
            return;
        }

        if (shouldLoadAccountVeterans()) {
            fetchAccountVeterans()
                .then(({ viewerId, veteranCount, updatedAt, veterans: loadedVeterans }) => {
                    setOwnedVeterans(loadedVeterans);
                    setAccountVeteranMeta({ viewerId, veteranCount, updatedAt });
                    setError("");
                })
                .catch(err => setError(`Failed to load your veteran roster: ${err.message}`));
        }
    }, []);

    useEffect(() => {
        if (!authenticated || !user) {
            setAccountVeteranSnapshot(null);
            return;
        }

        let cancelled = false;
        fetch("/api/account/horseact-verification/status", {
            credentials: "same-origin",
        })
            .then((response) => response.ok ? response.json() as Promise<AccountHorseActVerificationStatusResponse> : null)
            .then((payload) => {
                if (!cancelled) {
                    setAccountVeteranSnapshot(payload?.linkedGameAccount ? payload.veteranSnapshot : null);
                }
            })
            .catch(() => {
                if (!cancelled) setAccountVeteranSnapshot(null);
            });

        return () => {
            cancelled = true;
        };
    }, [authenticated, user]);

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/\.json$/i.test(file.name)) {
            setError("Please choose a .json file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result ?? ""));
                if (!Array.isArray(parsed)) throw new Error("Not an array");
                setOwnedVeterans(parsed);
                setSourceTab("owned");
                setError("");
            } catch (err) {
                setError(`Failed to parse JSON: ${err}`);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const runUmaMoeSearch = async (page: number, append: boolean) => {
        setMoeSearching(true);
        setMoeError("");
        const signature = moeSearchSignature;

        try {
            const result = await searchUmaMoeVeterans(customScoringConfig, parentCharaIds, umaMoeSearchFilters, page);
            setMoeVeterans(current => {
                if (!append) return result.veterans;

                const seen = new Set(current.map(veteran => veteran.trained_chara_id));
                return [
                    ...current,
                    ...result.veterans.filter(veteran => !seen.has(veteran.trained_chara_id)),
                ];
            });
            setMoeMeta(result);
            setMoeSearchParamsKey(signature);
            setSourceTab("moe");
            setActiveSort("custom");
        } catch (err: any) {
            setMoeError(err?.message ?? String(err));
        } finally {
            setMoeSearching(false);
        }
    };

    const handleUmaMoeSearchButton = () => {
        if (!moeSearchIsCurrent) {
            void runUmaMoeSearch(0, false);
            return;
        }

        if (!moeCanLoadMore || !moeMeta) return;
        void runUmaMoeSearch(moeMeta.page + 1, true);
    };

    const handleAddFilter = (stateKey: string, filter: BaseFilter) => {
        const setters: Record<string, React.Dispatch<React.SetStateAction<BaseFilter[]>>> = {
            bluesFilters: setBluesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            aptitudeFilters: setAptitudeFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            uniquesFilters: setUniquesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            racesFilters: setRacesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            skillsFilters: setSkillsFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
        };
        setters[stateKey]?.(prev => {
            const filterStatsKey = getFilterStats(filter).join("|");
            const filterStarsKey = getFilterStarOptions(filter).join("|");

            if (prev.some(f =>
                f.type === filter.type &&
                getFilterStats(f).join("|") === filterStatsKey &&
                getFilterStarOptions(f).join("|") === filterStarsKey
            )) {
                return prev;
            }
            return [...prev, filter];
        });
    };

    const handleRemoveFilter = (stateKey: string, filterId: string) => {
        const setters: Record<string, React.Dispatch<React.SetStateAction<BaseFilter[]>>> = {
            bluesFilters: setBluesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            aptitudeFilters: setAptitudeFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            uniquesFilters: setUniquesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            racesFilters: setRacesFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
            skillsFilters: setSkillsFilters as React.Dispatch<React.SetStateAction<BaseFilter[]>>,
        };
        setters[stateKey]?.(prev => prev.filter(f => f.id !== filterId));
    };

    const handleClearAllFilters = () => {
        setBluesFilters([]);
        setAptitudeFilters([]);
        setUniquesFilters([]);
        setRacesFilters([]);
        setSkillsFilters([]);
        setActiveSort("date");
        setSortDirection("desc");
    };

    const toggleSelector = (key: string | null) => {
        setShowBluesSelector(key === "blues");
        setShowAptitudeSelector(key === "aptitude");
        setShowUniquesSelector(key === "uniques");
        setShowRacesSelector(key === "races");
        setShowSkillsSelector(key === "skills");
    };

    let displayVeterans: Veteran[] = [];
    let renderError: string | null = null;

    if (veterans.length > 0) {
        try {
            const filters = {
                blues: bluesFilters,
                aptitude: aptitudeFilters,
                uniques: uniquesFilters,
                races: racesFilters,
                skills: skillsFilters,
            };
            displayVeterans = applyFiltersAndSort(
                veterans,
                filters,
                FILTER_CONFIG,
                activeSort,
                sortDirection,
                nameSearch,
                affinityCharaId,
                parentCharaIds,
                customScoringConfig,
                customScoreContext,
            );

            const excludedCharaIds = new Set<number>();
            if (affinityParent1) excludedCharaIds.add(Math.floor(affinityParent1.card_id / 100));
            if (affinityParent2) excludedCharaIds.add(Math.floor(affinityParent2.card_id / 100));
            if (excludedCharaIds.size > 0) {
                displayVeterans = displayVeterans.filter(v => !excludedCharaIds.has(Math.floor(v.card_id / 100)));
            }
        } catch (e: any) {
            console.error("Filter/Sort Logic Crashed", e);
            renderError = "Error processing veteran data. Please clear filters or reload.";
        }
    }

    const visibilityState = {
        blues: showBluesSelector,
        aptitude: showAptitudeSelector,
        uniques: showUniquesSelector,
        races: showRacesSelector,
        skills: showSkillsSelector,
    };
    const showOpenMyVeterans = !!accountVeteranSnapshot?.available && !accountVeteranMeta;
    const activeUmaMoeFilterCount = bluesFilters.length
        + aptitudeFilters.length
        + uniquesFilters.length
        + racesFilters.length
        + skillsFilters.length;

    return (
        <Container className="vet-page-container">
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="vet-file-input" />

            <div className="vet-source-tabs">
                <Button
                    variant={sourceTab === "owned" ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => setSourceTab("owned")}
                >
                    My veterans ({ownedVeterans.length})
                </Button>
                <Button
                    variant={sourceTab === "moe" ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => setSourceTab("moe")}
                >
                    uma.moe search{moeVeterans.length > 0 ? ` (${moeVeterans.length})` : ""}
                </Button>
                <Button
                    variant={sourceTab === "best" ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => setSourceTab("best")}
                >
                    Best combo
                </Button>
            </div>

            {sourceTab === "best" && (
                <BestComboPanel
                    veterans={ownedVeterans}
                    config={FILTER_CONFIG}
                    scoringConfig={customScoringConfig}
                    onScoringChange={handleCustomScoringChange}
                    maxGpAffinity={customScoreRanges.maxGpAffinity}
                    maxRaceWins={customScoreRanges.maxRaceWins}
                />
            )}

            {sourceTab !== "best" && <>
            {sourceTab === "moe" && (
                <section className="vet-moe-search-panel">
                    <div>
                        <h2 className="vet-panel-title">uma.moe search</h2>
                        <p className="vet-moe-search-description">
                            These results come from uma.moe and stay separate from your uploaded veterans.
                        </p>
                        <div className="vet-moe-search-summary">
                            <span>White sparks: {customScoringConfig.skillSparkStyle}</span>
                            <span>
                                Pink preset: {customScoringConfig.pinkPreset === "custom"
                                    ? "Custom"
                                    : customScoringConfig.pinkPreset.replace("-", " ")}
                            </span>
                            <span>
                                Characters: {parentCharaIds.length > 0
                                    ? `${parentCharaIds.length} selected`
                                    : "All"}
                            </span>
                            <span>
                                Filters: {activeUmaMoeFilterCount > 0 ? activeUmaMoeFilterCount : "None"}
                            </span>
                        </div>
                        <div className="vet-moe-search-characters">
                            <ParentCharacterFilter
                                veterans={veterans}
                                selected={parentCharaIds}
                                onChange={setParentCharaIds}
                                includeAllCharacters
                            />
                        </div>
                    </div>
                    <div className="vet-moe-search-actions">
                        <CustomScoringPanel
                            config={customScoringConfig}
                            onChange={handleCustomScoringChange}
                            maxGpAffinity={customScoreRanges.maxGpAffinity}
                            maxRaceWins={customScoreRanges.maxRaceWins}
                        />
                        <Button
                            variant="primary"
                            onClick={handleUmaMoeSearchButton}
                            disabled={moeSearching || (moeSearchIsCurrent && !moeCanLoadMore)}
                        >
                            {moeSearching
                                ? (moeSearchIsCurrent ? "Loading..." : "Searching uma.moe...")
                                : moeSearchIsCurrent
                                    ? (moeCanLoadMore ? "Load 100 more" : "All results loaded")
                                    : "Search uma.moe (100)"}
                        </Button>
                    </div>
                    {moeError && (
                        <Alert variant="danger" className="vet-moe-search-error" dismissible onClose={() => setMoeError("")}>
                            {moeError}
                        </Alert>
                    )}
                    {moeMeta && (
                        <div className="vet-moe-search-meta">
                            uma.moe reports {moeMeta.total} matching records. Showing {moeVeterans.length}
                            {moeSearchIsCurrent ? ` (page ${moeMeta.page + 1} of ${moeMeta.totalPages}).` : "."}
                            {!moeSearchIsCurrent && " Search parameters changed — run a new search to update results."}
                        </div>
                    )}
                </section>
            )}

            {sourceTab === "moe" && (
                <section className="vet-panel-card vet-panel-card--filters vet-moe-filter-card">
                    <div className="vet-panel-header">
                        <div>
                            <h2 className="vet-panel-title">uma.moe search filters</h2>
                        </div>
                    </div>
                    <div className="vet-filter-buttons">
                        <FilterToolbar
                            config={FILTER_CONFIG}
                            visibilityState={visibilityState}
                            onToggle={toggleSelector}
                            onAddFilter={handleAddFilter}
                            getAvailableStats={(catId) => getAvailableStats(veterans, catId, true)}
                        />
                    </div>
                    <ActiveFiltersList
                        filters={{ bluesFilters, aptitudeFilters, uniquesFilters, racesFilters, skillsFilters }}
                        config={FILTER_CONFIG}
                        onRemove={handleRemoveFilter}
                        onClearAll={handleClearAllFilters}
                    />
                </section>
            )}

            {(error || renderError) && (
                <Alert variant="danger" dismissible onClose={() => setError("")}>
                    {error || renderError}
                </Alert>
            )}

            {sourceTab === "owned" && !ownedVeterans.length && !error && !renderError && (
                <>
                    <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                        <div className="upload-icon">Upload</div>
                        <div className="upload-label">No veterans loaded</div>
                        <div className="upload-sublabel">Upload a JSON file or share link to get started</div>
                    </div>
                    {showOpenMyVeterans ? (
                        <div className="d-flex justify-content-center mb-3">
                            <Button variant="outline-info" href="/veterans?mine=1">
                                Open my veterans
                            </Button>
                        </div>
                    ) : null}
                    <Alert variant="info" className="vet-upload-alert">
                        This page supports both veteran data extracted via the hachimi plugin on the <a href="https://github.com/ayaliz/horseACT#installation" target="_blank" rel="noreferrer">horseACT setup guide</a>, as well as the standalone umaextractor on <a href="https://github.com/xancia/UmaExtractor/releases/latest" target="_blank" rel="noreferrer">https://github.com/xancia/UmaExtractor/releases/latest</a>.
                    </Alert>
                </>
            )}

            {veterans.length > 0 && !renderError && (
                <>
                    {sourceTab === "owned" && accountVeteranMeta ? (
                        <Alert variant="info">
                            Loaded your stored veteran roster for viewer ID {accountVeteranMeta.viewerId}. Snapshot contains {accountVeteranMeta.veteranCount} veterans and was last updated on {new Date(accountVeteranMeta.updatedAt).toLocaleString()}.
                        </Alert>
                    ) : null}
                    {sourceTab === "owned" && showOpenMyVeterans ? (
                        <div className="d-flex justify-content-end mb-3">
                            <Button variant="outline-info" href="/veterans?mine=1">
                                Open my veterans
                            </Button>
                        </div>
                    ) : null}
                    <div className="vet-top-layout">
                        <div className="vet-top-left">
                            {sourceTab === "owned" && (
                                <section className="vet-panel-card vet-panel-card--filters">
                                    <div className="vet-panel-header">
                                        <div>
                                            <h2 className="vet-panel-title">Filters</h2>
                                        </div>
                                    </div>
                                    <div className="vet-filter-buttons">
                                        <FilterToolbar
                                            config={FILTER_CONFIG}
                                            visibilityState={visibilityState}
                                            onToggle={toggleSelector}
                                            onAddFilter={handleAddFilter}
                                            getAvailableStats={(catId) => getAvailableStats(veterans, catId)}
                                        />
                                    </div>
                                    <ActiveFiltersList
                                        filters={{ bluesFilters, aptitudeFilters, uniquesFilters, racesFilters, skillsFilters }}
                                        config={FILTER_CONFIG}
                                        onRemove={handleRemoveFilter}
                                        onClearAll={handleClearAllFilters}
                                    />
                                </section>
                            )}

                            <section className="vet-panel-card vet-panel-card--results" ref={vetListRef}>
                                <div className="vet-panel-header vet-panel-header--results">
                                    <div className="vet-results-title-row">
                                        <h2 className="vet-panel-title">
                                            {sourceTab === "moe" ? "uma.moe Results" : "Results"}
                                        </h2>
                                        {sourceTab === "moe" && (
                                            <span className="vet-uma-moe-badge">uma.moe</span>
                                        )}
                                    </div>
                                    <div className="vet-results-header-right">
                                        <span className="vet-results-count">
                                            Showing {displayVeterans.length} of {veterans.length} veterans
                                        </span>
                                        <div className="vet-spark-display-toggle">
                                            <span className="vet-spark-display-label">Sparks</span>
                                            <ButtonGroup size="sm">
                                                <Button
                                                    variant={sparkDisplayMode === "separate" ? "secondary" : "outline-secondary"}
                                                    onClick={() => setSparkDisplayMode("separate")}
                                                >
                                                    Separate
                                                </Button>
                                                <Button
                                                    variant={sparkDisplayMode === "combined" ? "secondary" : "outline-secondary"}
                                                    onClick={() => setSparkDisplayMode("combined")}
                                                >
                                                    Combined
                                                </Button>
                                                <Button
                                                    variant={sparkDisplayMode === "gp" ? "secondary" : "outline-secondary"}
                                                    onClick={() => setSparkDisplayMode("gp")}
                                                >
                                                    GP view
                                                </Button>
                                            </ButtonGroup>
                                        </div>
                                    </div>
                                </div>
                                <div className="vet-search-row">
                                    <InputGroup className="vet-search-input">
                                        <Form.Control
                                            placeholder="Search by name..."
                                            value={nameSearch}
                                            onChange={e => setNameSearch(e.target.value)}
                                        />
                                        {nameSearch && (
                                            <Button variant="outline-secondary" onClick={() => setNameSearch("")}>{"\u00D7"}</Button>
                                        )}
                                    </InputGroup>
                                    {sourceTab === "owned" && (
                                        <ParentCharacterFilter
                                            veterans={veterans}
                                            selected={parentCharaIds}
                                            onChange={setParentCharaIds}
                                        />
                                    )}
                                </div>
                                <div className="vet-sort-share-group">
                                    <VeteransSorter
                                        activeSort={activeSort}
                                        sortDirection={sortDirection}
                                        onSortChange={setActiveSort}
                                        onDirectionToggle={() => setSortDirection(prev => (prev === "desc" ? "asc" : "desc"))}
                                        affinityCharaId={affinityCharaId}
                                    />
                                    {sourceTab === "owned" && (
                                        <CustomScoringPanel
                                            config={customScoringConfig}
                                            onChange={handleCustomScoringChange}
                                            maxGpAffinity={customScoreRanges.maxGpAffinity}
                                            maxRaceWins={customScoreRanges.maxRaceWins}
                                        />
                                    )}
                                    <OptimizerPanel veterans={veterans} />
                                </div>
                            </section>
                        </div>

                        <div className="vet-top-right">
                            <AffinityCalculatorPanel
                                mainCharId={affinityCharaId}
                                onMainCharChange={id => {
                                    setAffinityCharaId(id);
                                    if (id && activeSort === "date") setActiveSort("affinity");
                                }}
                                parent1={affinityParent1}
                                parent2={affinityParent2}
                                parent2IsBorrowed={parent2IsBorrowed}
                                activeSlot={activeAffinitySlot}
                                onLegacySlotClick={handleLegacySlotClick}
                                onBorrowLookup={handleBorrowLookup}
                                borrowLoading={borrowLoading}
                                onReset={handleAffinityReset}
                                onPlannerOpen={() => setShowPlanner(true)}
                                onSparkProcOpen={() => setShowSparkProc(true)}
                            />
                            <RacePlannerModal
                                show={showPlanner}
                                onHide={() => setShowPlanner(false)}
                                mainCharId={affinityCharaId}
                                parent1={affinityParent1}
                                parent2={affinityParent2}
                            />
                            <SparkProcModal
                                show={showSparkProc}
                                onHide={() => setShowSparkProc(false)}
                                mainCharId={affinityCharaId}
                                parent1={affinityParent1}
                                parent2={affinityParent2}
                                config={FILTER_CONFIG}
                            />
                        </div>
                    </div>

                    <div className="vet-grid">
                        {displayVeterans.map((veteran, index) => (
                            <VeteranCard
                                key={`${veteran.card_id}-${index}`}
                                veteran={veteran}
                                config={FILTER_CONFIG}
                                affinityCharaId={affinityCharaId}
                                legacyParent1={affinityParent1}
                                legacyParent2={affinityParent2}
                                onSelectForSlot={handleSelectForSlot}
                                customScore={customScores?.get(veteran)}
                                sparkDisplayMode={sparkDisplayMode}
                                highlightedFactorKeys={searchHighlightedFactorKeys}
                            />
                        ))}
                    </div>
                </>
            )}
            </>}
        </Container>
    );
}
