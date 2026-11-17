import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Container, Nav, Navbar, Spinner } from "react-bootstrap";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import './App.css';
import './dark-mode.css';
import UMDatabaseWrapper from './data/UMDatabaseWrapper';
import GameDataLoader from './data/GameDataLoader';
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

const VeteransPage = lazyWithReload(() => import("./pages/VeteransPage"), "VeteransPage");

const PAGE_META = {
    veterans: {
        title: "Veterans",
        description: "Local-only Umamusume veterans browser with custom scoring, Best combo, and Best GP combo search. Slopforked from Hakuraku by ayaliz.",
    },
};

function withMeta(meta: { title: string; description?: string; noIndex?: boolean }, element: React.ReactNode) {
    return <><PageMeta {...meta} />{element}</>;
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
        <AppShell />
    </BrowserRouter>;
}

function AppShell() {
    return <>
        <Navbar className="haku-nav" variant="dark" expand="lg">
            <Container>
                <Navbar.Brand as={Link} to="/">forkuraku</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />

                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={NavLink} to="/veterans">Veterans</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>

        <Container>
            <Suspense fallback={<div className="p-4 text-center"><Spinner animation="border" /></div>}>
                <Routes>
                    <Route path="/veterans" element={withMeta(PAGE_META.veterans, <VeteransPage />)} />
                    <Route path="/" element={withMeta(PAGE_META.veterans, <VeteransPage />)} />
                    <Route path="*" element={<Navigate to="/veterans" replace />} />
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
                    slopforked from Hakuraku by ayaliz
                </a>
            </Container>
        </footer>
    </>;
}

