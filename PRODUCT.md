# 奇物局 — development brief

<!-- impeccable:product-schema 1 -->

This is a non-authoritative design brief for this new App. Platform and capability authority remains in `.nimi/spec/**`; it does not change Nimi ownership, lifecycle, or capability contracts.

## Platform

web

## Users

Working assumption delegated by the user's open brief: curious people who want a short, surprising game made from their own ordinary surroundings.

## Product Purpose

Turn a photo into a playable, absurd object mystery. Fun, replayability and something AI uniquely enables are the user's stated acceptance criteria.

## Operating Context

A real Nimi App developed with app-tools and the public SDK/Kit, running in the Desktop-supervised Electron carrier. Chinese is the initial product language.

## Capabilities and Constraints

`vision.locate` supplies real normalized image coordinates. Text generation supplies the case and role-play. Optional Runtime speech reads character dialogue. Runtime owns execution, routing and availability. No hardcoded provider/model, authored hotspot substitutes, fake success, or silent demo fallback.

## Product Principles

- A photo is the actual game board.
- Discover, question, connect, accuse: a complete short play loop.
- Any built-in image is a sample scene, never a precomputed AI result.
- The story is fictional and playful; visible evidence and the final answer must agree.
- Preserve play progress across reloads using the admitted Kit shell storage surface.
