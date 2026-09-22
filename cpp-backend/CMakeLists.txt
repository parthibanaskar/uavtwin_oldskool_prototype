cmake_minimum_required(VERSION 3.14)
project(uavtwin_backend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# Fetch cpp-httplib
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG        v0.15.3
)
FetchContent_MakeAvailable(httplib)

add_executable(server main.cpp)
target_link_libraries(server PRIVATE httplib::httplib)

# On Windows we need to link against wsock32 and ws2_32
if (WIN32)
    target_link_libraries(server PRIVATE wsock32 ws2_32)
endif()
