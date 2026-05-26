To fix the issues we've had with Nixpacks, we built Railpack.

Since we transitioned away from Nix, we also transitioned away from the name Nixpacks in favor of Railpack. We also changed the codebase from Rust to Go because of the Buildkit libraries.

Here are some architectural highlights:

    We generate a custom BuildKit LLB + Frontend to give us much more control over how the final image is constructed — resulting in 38% smaller base Node and 77% smaller base Python images compared to building with Nixpacks
    We use Mise for version resolution and most package installation, though it leaves room to support other executable sources in the future
    We're now able to lock the dependencies used when a successful build happens. This means that builds won't break when we update the default Node version from 22 to 24
    We improved secret environment variable management. Railpack leverages BuildKit secrets to prevent variables from appearing in build logs or the final image

How it works

The Railpack process is split into three parts:

    Analyze: Look at the code and determine what packages should be installed, what commands should be run, and what the start command should be
    Plan: Create a build plan in a JSON-serializable format that contains several steps, each with inputs derived from other steps or entire images.
    Generates: Construct a BuildKit build graph based on the inputs and outputs from the plan.

config instructions:
    https://railpack.com/languages/node