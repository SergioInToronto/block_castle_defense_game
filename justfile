# Development commands for Block Castle Defense Game

# Start the development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Preview production build
preview:
    npm run preview

# Install dependencies
install:
    npm install

# Check code with ESLint
lint:
    npm run lint

# Fix linting issues automatically
lint-fix:
    npm run lint:fix

# Format code with Prettier
format:
    npm run format

# Check if code is formatted
format-check:
    npm run format:check

# Run both linting and formatting
check: lint format-check