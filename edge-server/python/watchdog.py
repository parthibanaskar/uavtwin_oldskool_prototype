import time
import subprocess
import sys

def main():
    script_path = "main.py"
    while True:
        print(f"[Watchdog] Starting {script_path}...")
        process = subprocess.Popen([sys.executable, script_path])
        process.wait()
        
        exit_code = process.returncode
        print(f"[Watchdog] Process exited with code {exit_code}")
        
        if exit_code == 0:
            print("[Watchdog] Clean exit. Shutting down watchdog.")
            break
            
        print("[Watchdog] Process crashed! Restarting in 3 seconds...")
        time.sleep(3)

if __name__ == '__main__':
    main()
