# CLAUDE.md

# ATP Platform - Claude Code Development Rules

## Purpose

This document defines the permanent development rules for Claude Code while working on this repository.

These instructions have higher priority than temporary prompts unless explicitly overridden by the project owner.

---

# General Objective

Build and maintain a modern, high-performance digital platform for ATP, a student organization (not an academic institution) at the Facultad de Ciencias Médicas of the Universidad Nacional de Rosario.

The platform must be:

- Fast
- Mobile-first
- Beautiful
- Accessible
- Maintainable
- Easily editable
- Static-first
- Future-proof

Never optimize for writing code quickly.

Always optimize for code quality, maintainability, user experience and long-term scalability.

---

# Core Principles

When multiple solutions are possible, prioritize in this order:

1. Simplicity
2. Readability
3. Reusability
4. Performance
5. Accessibility
6. Scalability

Avoid unnecessary complexity.

Never introduce a dependency if native Astro or TypeScript features solve the same problem.

---

# Development Philosophy

Treat this repository as a real production application.

Never generate temporary, experimental or placeholder implementations unless explicitly requested.

Every feature should be production-ready.

---

# Architecture

Always maintain a component-based architecture.

Prefer many small reusable components instead of large components.

Each component should have one clear responsibility.

Avoid duplicated code.

If duplicated logic appears twice, refactor.

---

# Code Quality

Always produce:

- strict TypeScript
- clean code
- meaningful variable names
- meaningful component names
- predictable folder structure

Never leave unused variables.

Never leave commented-out code.

Never leave TODOs unless requested.

Never use "any" unless absolutely unavoidable.

---

# Performance

Performance is a first-class requirement.

Always optimize for:

- Lighthouse Performance >95
- Accessibility >95
- Best Practices >95
- SEO >95

Minimize JavaScript.

Prefer server rendering whenever possible.

Hydrate only interactive components.

Avoid unnecessary client-side rendering.

---

# Mobile First

Always design for mobile first.

Desktop is an enhancement.

Assume most users are on smartphones.

Layouts must work perfectly from 320px width.

---

# Responsive Design

Support at least:

320px

375px

390px

430px

768px

1024px

1280px

1536px

Never hardcode viewport-specific layouts.

---

# Accessibility

Accessibility is mandatory.

Always:

Use semantic HTML.

Use proper heading hierarchy.

Use ARIA labels when needed.

Support keyboard navigation.

Maintain sufficient contrast.

Support screen readers.

Visible focus states are required.

Never remove outline without replacement.

---

# SEO

Every page must include:

Meaningful title

Meta description

Canonical URL

Open Graph tags

Twitter cards

Structured metadata when appropriate.

Generate semantic URLs.

Avoid duplicate content.

---

# Design Philosophy

Visual inspiration:

- Apple
- iOS Human Interface Guidelines
- Airbnb
- Linear

Design characteristics:

Minimal

Elegant

Premium

Calm

Clean

Large spacing

Subtle animations

Glass effects only when appropriate

Never overdesign.

Never overload interfaces.

Whitespace is valuable.

---

# Animations

Animations should feel natural.

Prefer:

Fade

Slide

Scale

Blur

Opacity

Avoid flashy effects.

Animation duration:

150–350ms

Use easing.

Respect prefers-reduced-motion.

---

# Color Usage

Use the project's design system.

Never invent colors.

Never use random Tailwind colors.

Always reference design tokens.

---

# Typography

Typography is part of the design system.

Never hardcode font sizes repeatedly.

Use typography tokens.

Maintain clear visual hierarchy.

---

# Components

Components must be reusable.

Prefer composition.

Never create page-specific UI if it can become reusable.

Examples:

Button

Card

Modal

Badge

Carousel

SearchBar

BookCard

ActivityCard

Hero

Navbar

Footer

SectionHeader

FilterPanel

---

# State Management

Keep state local whenever possible.

Avoid global state unless necessary.

Avoid unnecessary complexity.

---

# Forms

Forms should:

Validate input

Show clear errors

Prevent duplicate submissions

Be accessible

Provide loading feedback

---

# Images

Always optimize images.

Lazy load below-the-fold images.

Use responsive sizes.

Avoid oversized assets.

Prefer WebP when appropriate.

---

# Icons

Use a single icon system consistently.

Do not mix icon libraries.

---

# Content

Content must never be hardcoded inside components.

All editable information belongs in the content layer.

Components should display data, not contain data.

---

# Content Collections

Whenever possible, use Astro Content Collections.

Maintain schema validation.

Never allow inconsistent data structures.

---

# File Organization

Prefer:

components/

layouts/

pages/

content/

lib/

styles/

types/

assets/

public/

Keep folders organized.

Avoid dumping files into root directories.

---

# Naming

Use English for:

Folders

Files

Variables

Functions

Components

Interfaces

Types

Use consistent naming.

Examples:

BookCard

ActivityCarousel

SearchFilters

CalendarView

Never mix naming conventions.

---

# Error Handling

Handle failures gracefully.

Never assume external resources always work.

Display useful fallback UI.

---

# External Services

External services should be isolated.

Never scatter API logic across components.

---

# Git

Generate logical commits.

Avoid changing unrelated files.

Respect existing architecture.

---

# Documentation

Public functions should be understandable.

Complex logic deserves concise comments.

Do not over-comment obvious code.

---

# Security

Never expose secrets.

Never trust user input.

Sanitize dynamic content.

---

# Internationalization

The architecture should be prepared for multiple languages.

Primary language:

Spanish

Future support:

Portuguese

Avoid hardcoding language assumptions.

---

# Progressive Web App

The application should behave like a modern installable web app.

Support:

offline assets

icons

manifest

theme color

service worker

when appropriate.

---

# Search

Search should be fast.

Prefer local indexing.

Avoid unnecessary server calls.

---

# Token Optimization

Claude Code should minimize token usage during development.

Before generating code:

Read existing implementation.

Modify only what is necessary.

Never regenerate entire files unless required.

Prefer incremental edits.

Avoid repeating explanations.

Avoid rewriting unchanged code.

When asked to implement a feature:

First inspect existing architecture.

Reuse components.

Reuse utilities.

Reuse layouts.

Reuse styles.

Only create new files if necessary.

---

# Decision Making

If multiple implementations are valid:

Choose the one that:

reduces maintenance

reduces complexity

improves readability

improves performance

improves user experience

---

# Quality Standard

Every implementation should feel like it belongs in a polished production application.

Avoid hacks.

Avoid shortcuts.

Avoid quick fixes.

Build software that can be maintained for years.

---

# Final Rule

Always think before coding.

Understand the architecture first.

Respect existing patterns.

Write less code when less code is better.

Every new line of code should have a clear reason to exist.