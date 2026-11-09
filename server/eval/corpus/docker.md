# Docker image best practices

Each instruction in a Dockerfile creates a layer. Docker reuses a cached layer only if the instruction and everything before it are unchanged, so put rarely changing steps, such as installing dependencies, before frequently changing steps such as copying source code.

Multi-stage builds keep final images small. Compile your application in a build stage that has the full toolchain, then copy only the compiled output into a slim runtime stage. The build tools never reach the image you ship.

A `.dockerignore` file excludes files like `node_modules` and `.git` from the build context, which speeds up builds and avoids leaking secrets. Use named volumes for data that must outlive a container, and add a HEALTHCHECK instruction so orchestrators can detect a container that is running but unresponsive.

Run the application as a non-root user to limit the damage if the container is compromised.
