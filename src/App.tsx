import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Container, Nav, Navbar, Spinner } from "react-bootstrap";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import './App.css';
import './dark-mode.css';
import UMDatabaseWrapper from './data/UMDatabaseWrapper';
import GameDataLoader from './data/GameDataLoader';
import { AuthProvider, useAuth } from "./auth/AuthContext";
import PageMeta from "./components/PageMeta";

// Wraps lazy() to auto-reload once on chunk load failure (stale deploy hash mismatch).
function lazyWithReload<T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    name: string
) {
    return lazy(() =>
        factory().catch(() => {
            const key = `chunk-reload:${name}`;
            if (!sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, '1');
                window.location.reload();
            }
            return new Promise<{ default: T }>(() => {});
        })
    );
}

const RaceDataPage    = lazyWithReload(() => import("./pages/RaceDataPage"),    "RaceDataPage");
const MultiRacePage   = lazyWithReload(() => import("./pages/MultiRacePage"),   "MultiRacePage");
const UmaLogsPage     = lazyWithReload(() => import("./pages/SimDataPage"),     "UmaLogsPage");
const MasterDataPage  = lazyWithReload(() => import("./pages/MasterDataPage"),  "MasterDataPage");
const NotesPage       = lazyWithReload(() => import("./pages/NotesPage"),       "NotesPage");
const SetupGuidePage  = lazyWithReload(() => import("./pages/SetupGuidePage"),  "SetupGuidePage");
const VeteransPage      = lazyWithReload(() => import("./pages/VeteransPage"),      "VeteransPage");
const ShopRefreshPage   = lazyWithReload(() => import("./pages/ShopRefreshPage"),  "ShopRefreshPage");
const InheritanceFactorsPage = lazyWithReload(() => import("./pages/InheritanceFactorsPage"), "InheritanceFactorsPage");
const AuthPage        = lazyWithReload(() => import("./pages/AuthPage"),        "AuthPage");
const AccountPage     = lazyWithReload(() => import("./pages/AccountPage"),     "AccountPage");
const PrivacyPolicyPage = lazyWithReload(() => import("./pages/PrivacyPolicyPage"), "PrivacyPolicyPage");
// Search-result copy for each route. Kept together so the titles and descriptions can be read
// side by side; they compete with each other in results, so they need to stay distinct.
const PAGE_META: Record<string, { title: string; description?: string; noIndex?: boolean }> = {
    veterans: {
        title: "Veterans",
        description: "Browse veteran Umamusume race entries and their training, stats, skills and results.",
    },
    racedata: {
        title: "Race Analysis",
        description: "Replay an Umamusume race frame by frame: last spurt speeds, skill activations and durations, HP drain, position keep and blocking.",
    },
    multirace: {
        title: "Multi-Race Analysis",
        description: "Analyse many Umamusume races at once to find patterns in spurt success, skill activation rates and running style matchups.",
    },
    umalogs: {
        title: "UmaLogs",
        description: "Explore simulated Champions Meeting data built from captured Umamusume teams.",
    },
    setup: {
        title: "Setup Guide",
        description: "How to capture your own Umamusume race data and load it into Hakuraku for analysis.",
    },
    masterdata: {
        title: "Master Data",
        description: "Search the Umamusume master database: skills, Umas, support cards, races and their raw effect values.",
    },
    notes: {
        title: "Research Notes",
        description: "Write-ups on Umamusume race mechanics: speed formulas, skill scaling, stamina and last spurt behaviour.",
    },
    shopRefresh: {
        title: "Shop Refresh",
        description: "Crowdsourced Umamusume shop refresh data.",
    },
    inheritanceFactors: {
        title: "Inheritance Factors",
        description: "Umamusume inheritance factor data and spark analysis.",
    },
    auth: { title: "Log In", noIndex: true },
    account: { title: "Account", noIndex: true },
    privacy: { title: "Privacy Policy", description: "How Hakuraku handles your data." },
};

function withMeta(meta: { title: string; description?: string; noIndex?: boolean }, element: React.ReactNode) {
    return <><PageMeta {...meta} />{element}</>;
}

function RedirectToUmaLogs() {
    const { search, hash } = useLocation();
    return <Navigate to={{ pathname: "/umalogs", search, hash }} replace />;
}

export default function App() {
    const [umdbLoaded, setUmdbLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            UMDatabaseWrapper.initialize(),
            GameDataLoader.initialize(),
        ]).then(() => {
            if (!cancelled) {
                setUmdbLoaded(true);
            }
        }).catch(err => {
            console.error("Failed to initialize data loaders:", err);
            if (!cancelled) {
                setLoadError(err instanceof Error ? err.message : "Failed to initialize local data files.");
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    if (loadError) {
        return (
            <Container className="py-5">
                <Alert variant="danger">
                    <Alert.Heading>Failed to load local game data</Alert.Heading>
                    <p className="mb-2">{loadError}</p>
                    <p className="mb-0">
                        Make sure the repository includes the required files in
                        <code> public/data/</code>, especially
                        <code> umdb.binarypb.gz</code> and
                        <code> gamedata.bin.gz</code>.
                    </p>
                </Alert>
            </Container>
        );
    }

    if (!umdbLoaded) {
        return <div><Spinner animation="border" /> Loading UMDatabase...</div>;
    }

    return <BrowserRouter>
        <AuthProvider>
            <AppShell />
        </AuthProvider>
    </BrowserRouter>;
}

function AppShell() {
    const { authenticated, user } = useAuth();

    return <>
        <Navbar className="haku-nav" variant="dark" expand="lg">
            <Container>
                <Navbar.Brand as={Link} to="/">forkuraku</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />

                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
                        <Nav.Link as={NavLink} to="/veterans">Veterans</Nav.Link>
                        <Nav.Link as={NavLink} to="/racedata">Race Analysis</Nav.Link>
                        <Nav.Link as={NavLink} to="/multirace">Multi-Race Analysis</Nav.Link>
                    </Nav>
                    <Nav className="ms-auto align-items-lg-center">
                        {authenticated && user ? (
                            <Nav.Link as={NavLink} to="/account">{user.accountName}</Nav.Link>
                        ) : null}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>

        <Container>
            <Suspense fallback={<div className="p-4 text-center"><Spinner animation="border" /></div>}>
                <Routes>
                    <Route path="/veterans" element={withMeta(PAGE_META.veterans, <VeteransPage />)} />
                    <Route path="/racedata/:raceUid" element={withMeta(PAGE_META.racedata, <RaceDataPage />)} />
                    <Route path="/racedata" element={withMeta(PAGE_META.racedata, <RaceDataPage />)} />
                    <Route path="/multirace" element={withMeta(PAGE_META.multirace, <MultiRacePage />)} />
                    <Route path="/umalogs" element={withMeta(PAGE_META.umalogs, <UmaLogsPage />)} />
                    <Route path="/simdata/*" element={<RedirectToUmaLogs />} />
                    <Route path="/setup" element={withMeta(PAGE_META.setup, <SetupGuidePage />)} />
                    <Route path="/masterdata" element={withMeta(PAGE_META.masterdata, <MasterDataPage />)} />
                    <Route path="/notes/:noteId" element={withMeta(PAGE_META.notes, <NotesPage />)} />
                    <Route path="/notes" element={withMeta(PAGE_META.notes, <NotesPage />)} />
                    <Route path="/shop-refresh" element={withMeta(PAGE_META.shopRefresh, <ShopRefreshPage />)} />
                    <Route path="/inheritance-factors" element={withMeta(PAGE_META.inheritanceFactors, <InheritanceFactorsPage />)} />
                    <Route path="/auth" element={withMeta(PAGE_META.auth, <AuthPage />)} />
                    <Route path="/account" element={withMeta(PAGE_META.account, <AccountPage />)} />
                    <Route path="/accounts" element={withMeta(PAGE_META.account, <AccountPage />)} />
                    <Route path="/privacy" element={withMeta(PAGE_META.privacy, <PrivacyPolicyPage />)} />
                    <Route path="/" element={withMeta(PAGE_META.veterans, <VeteransPage />)} />
                </Routes>
            </Suspense>
        </Container>

        <footer className="haku-footer">
            <Container className="haku-footer-inner">
                <a
                    href="https://github.com/ayaliz/hakuraku/"
                    target="_blank"
                    rel="noreferrer"
                    className="haku-footer-link"
                >
                    forkuraku, forked from Hakuraku
                </a>
            </Container>
        </footer>
    </>;
}

