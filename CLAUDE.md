# Frontend Development Guidelines

## Tech Stack
- Node.js
- React
- Vite
- TanStack Query
- TanStack Router
- Tailwind CSS

## Code Style and Structure

### General Principles
- Write concise, technical TypeScript code following industry best practices
- Avoid code duplication; use functions and modules for reusable logic
- Use functional and declarative programming patterns
- Avoid classes
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)

### File Structure
1. Exported component
2. Subcomponents
3. Helpers
4. Static content
5. Types

### Naming Conventions
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Favor named exports for components

### TypeScript Usage
- Use TypeScript for all code
- Prefer interfaces over types
- Avoid enums; use maps instead
- Use functional components with TypeScript interfaces

### Syntax and Formatting
- Use the `function` keyword for pure functions
- Use curly braces for all conditionals
- Favor simplicity over cleverness
- Use declarative JSX

### UI and Styling
- Use Tailwind for components and styling

### Performance Optimization
Focus on:
- Immutable data structures
- Efficient data fetching strategies
- Network request optimization
- Efficient data structures and algorithms
- Efficient rendering strategies
- Optimized state management

# Backend Development Guidelines

You are an expert in Rust, async programming.

### Key Principles
- Write clear, concise, and idiomatic Rust code with accurate examples.
- Do only the task I asked, do not try to other things
- Use async programming paradigms effectively.
- Prioritize modularity, clean code organization, and efficient resource management.
- Use expressive variable names that convey intent (e.g., `is_ready`, `has_data`).
- Adhere to Rust's naming conventions: snake_case for variables and functions, PascalCase for types and structs.
- Avoid code duplication; use functions and modules to encapsulate reusable logic.
- Write code with safety, concurrency, and performance in mind, embracing Rust's ownership and type system.
- When refactoring, make sure to remove unused code 

### Project Stack:
- Desktop application using Tauri Framework
- Diesel ORM for database access
- SQLite


### Error Handling and Safety
- Embrace Rust's Result and Option types for error handling.
- Use `?` operator to propagate errors in async functions.
- Implement custom error types using `thiserror` for more descriptive errors.
- Handle errors and edge cases early, returning errors where appropriate.
- Use `.await` responsibly, ensuring safe points for context switching.

### Testing
- Write unit tests with `tokio::test` for async tests.
- Use `tokio::time::pause` for testing time-dependent code without real delays.
- Implement integration tests to validate async behavior and concurrency.
- Use mocks and fakes for external dependencies in tests.


### Key Conventions
1. Structure the application into modules: separate concerns like networking, database, and business logic.
2. Use environment variables for configuration management (e.g., `dotenv` crate).
3. Ensure code is well-documented with inline comments and Rustdoc.

  