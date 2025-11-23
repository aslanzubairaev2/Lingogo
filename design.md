# Design Guidelines

This document outlines the design principles and guidelines for the Learning Phrase Practice application to ensure a consistent and user-friendly interface.

## General Principles

*   **Consistency:** All components should share a similar visual language, including colors, typography, and spacing.
*   **Simplicity:** Interfaces should be clean, uncluttered, and intuitive. Avoid unnecessary elements and decorations.
*   **Clarity:** Information should be presented clearly and concisely. Users should always understand what is happening and what they can do.
*   **Efficiency:** Workflows should be streamlined. Minimize the number of steps required to complete a task.

## Modals

*   **Purpose-driven:** Each modal should have a single, clear purpose.
*   **Minimalism:** Modals should not contain large, unnecessary titles or buttons that create extra steps. If a modal's purpose is to perform an action, it should initiate that action upon opening, if possible, showing a loading state.
*   **Standard Components:** Use consistent components for titles, buttons, and content within modals.
*   **Header:** Modal headers should be concise. Use a smaller font size for titles (e.g., `text-lg` or `text-xl`) and include a close button (`<button>`) on the top right.
*   **Content:** The body of the modal should be focused on the task at hand. Use spinners or loading indicators for asynchronous operations.
*   **Actions:** Confirmation buttons should be clearly labeled and consistently styled.

## Color Palette

*   **Primary:** Purple (`#8B5CF6`)
*   **Background:** Dark Slate (`#1E293B`, `#0F172A`)
*   **Text:** White, Light Slate (`#FFFFFF`, `#E2E8F0`)
*   **Accent:** Other shades of purple and slate.

## Typography

*   **Font:** Use a clean, sans-serif font.
*   **Hierarchy:** Use font size and weight to establish a clear visual hierarchy. Large, bold titles should be used sparingly, primarily for page headers, not modals.
