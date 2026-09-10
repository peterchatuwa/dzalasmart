# Contributing to Nzeru za Alimi

Thank you for your interest in contributing to Nzeru za Alimi! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dzalasmart.git
   cd dzalasmart
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up the database**:
   ```bash
   # Copy the example environment file
   cp server/.env.example server/.env
   # Edit server/.env and set your DATABASE_URL
   # For local development, you can omit it to use in-memory DB
   ```
5. **Run tests** to verify setup:
   ```bash
   npm test
   ```

## Development Workflow

1. **Create a branch** for your work:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following the code style:
   - Use meaningful variable and function names
   - Add comments for complex logic
   - Follow existing code patterns
   - Write tests for new functionality

3. **Test your changes**:

   ```bash
   npm test           # Run all tests
   npm run lint       # Check code style
   npm run format     # Format code
   ```

4. **Commit your changes**:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve bug in authentication"
   ```

   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions/changes
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## Code Style

- We use **ESLint** and **Prettier** for code formatting
- Run `npm run lint:fix` before committing
- Pre-commit hooks will automatically format your code
- Follow existing patterns in the codebase

## Testing

- Write unit tests for new functions and features
- Place tests in `server/test/` directory
- Use Node.js built-in test runner
- Ensure all tests pass before submitting a PR
- Aim for good test coverage

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments for public functions
- Update API documentation for new endpoints
- Include examples in documentation

## Pull Request Process

1. Ensure your code passes all tests and lint checks
2. Update documentation as needed
3. Fill out the pull request template
4. Link related issues
5. Wait for review from maintainers
6. Address review feedback
7. Once approved, your PR will be merged

## Reporting Bugs

1. Check if the bug is already reported in Issues
2. Use the Bug Report template
3. Include:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots if applicable

## Suggesting Features

1. Check if the feature is already suggested
2. Use the Feature Request template
3. Clearly describe:
   - The problem it solves
   - Proposed solution
   - Benefits to users
   - Implementation ideas (optional)

## Project Structure

```
dzalasmart/
├── server/          # Backend API and business logic
│   ├── src/         # Source code
│   └── test/        # Test files
├── frontend/        # Web frontend
├── android/         # Android Capacitor app
├── scripts/         # Deployment and utility scripts
└── .github/         # GitHub workflows and templates
```

## Need Help?

- Open an issue with your question
- Tag it with the `question` label
- Provide context and what you've tried

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to Nzeru za Alimi! 🌾
