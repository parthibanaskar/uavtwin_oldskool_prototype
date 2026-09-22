# C++ Backend

This is a standalone C++ web server intended to replace the Node.js backend. It uses `cpp-httplib` to serve HTTP requests.

## Prerequisites

Since this is C++, you must have a C++ compiler and CMake installed. 

**Windows Installation:**
1. Install [Visual Studio Community 2022](https://visualstudio.microsoft.com/downloads/).
2. During installation, select **Desktop development with C++**. This installs the MSVC compiler and CMake.
3. Open the **x64 Native Tools Command Prompt for VS 2022** from your Start menu to run the build commands below.

## Building the Server

Open your terminal (or VS Developer Prompt) in this directory (`cpp-backend`) and run:

```bash
mkdir build
cd build
cmake ..
cmake --build . --config Release
```

## Running the Server

Run the executable that was just built:

```bash
# From inside the build folder:
Release\server.exe
```

The server will start on `http://localhost:8080`.

## Frontend Integration

The server is configured to serve static frontend files from `../dist`.
To build your frontend:
1. In the `e:\uavtwin` directory, run `npm run build` (or `bun run build`).
2. If TanStack Start outputs the static client build to `.output/public` instead of `dist`, you will need to update `main.cpp` to point to `../.output/public` instead.

**Note:** Breaking away from the the default Node.js setup means you will likely no longer be able to use the the default live editor features.
