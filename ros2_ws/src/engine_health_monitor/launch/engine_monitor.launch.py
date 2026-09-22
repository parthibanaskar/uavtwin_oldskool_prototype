from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package='engine_health_monitor',
            executable='sensor_sampler_node',
            name='engine_sensor_sampler',
            output='screen',
        ),
        Node(
            package='engine_health_monitor',
            executable='px4_advisory_bridge',
            name='px4_advisory_bridge',
            output='screen',
        ),
        # In a real build, add the PX4 uXRCE-DDS agent here (or run it
        # separately): MicroXRCEAgent udp4 -p 8888
        # https://docs.px4.io/main/en/ros2/user_guide.html
    ])
