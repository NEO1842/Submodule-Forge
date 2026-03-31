# Submodule Forge

This web application executes a series of Git operations to generate a folder under the user's home directory and register a specified repository as a submodule.

## Requirements

- Node.js (version 14 or higher)
- Git
- npm (comes with Node.js)

## Installation

1. **Install Node.js and Git** (if not already installed):
   - Download from [nodejs.org](https://nodejs.org/) and [git-scm.com](https://git-scm.com/)

2. Clone this repository:
   ```bash
   git clone https://github.com/your-username/submodule-forge.git
   cd submodule-forge
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## How to Run

```bash
node server.js
```

Open your browser and go to `http://localhost:3000`.

## Notes

- This application works on Windows, macOS, and Linux.
- To push to `origin`, authentication credentials are required (username and token).
- Authentication username supports only usernames (email addresses are not supported).
- The submodule placement destination is specified as a "relative path within the base folder".
  - Example: `my-submodule` → `my-workspace/my-submodule`
- If you specify the "Repository URL to add submodule to", it will clone first and then add the submodule.
- Tokens are not displayed in logs and are not saved in configuration files.
