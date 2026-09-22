cmake_minimum_required(VERSION 3.8)
project(engine_health_monitor)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)
find_package(rosidl_default_generators REQUIRED)

# px4_msgs must be built/installed in your workspace first:
#   https://github.com/PX4/px4_msgs  (branch matching your PX4 firmware version)
find_package(px4_msgs REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/EngineTelemetry.msg"
  DEPENDENCIES std_msgs
)

include_directories(include)

add_executable(sensor_sampler_node src/sensor_sampler_node.cpp)
ament_target_dependencies(sensor_sampler_node rclcpp std_msgs)
rosidl_target_interfaces(sensor_sampler_node ${PROJECT_NAME} "rosidl_typesupport_cpp")

add_executable(px4_advisory_bridge src/px4_advisory_bridge.cpp)
ament_target_dependencies(px4_advisory_bridge rclcpp std_msgs px4_msgs)
rosidl_target_interfaces(px4_advisory_bridge ${PROJECT_NAME} "rosidl_typesupport_cpp")

install(TARGETS
  sensor_sampler_node
  px4_advisory_bridge
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})

ament_package()
