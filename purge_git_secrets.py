import os
import subprocess
import sys
import tempfile

# Define the exact strings to replace and their replacements
REPLACEMENTS = {
    "Vicky@2077": "[REDACTED_PASSWORD]",
    "Vicky@2007": "[REDACTED_PASSWORD]",
    "scattofot@2007": "[REDACTED_PASSWORD]",
}

TEMP_SCRIPT_CONTENT = """
import os

replacements = {replacements_dict}

# Skip these directories
skip_dirs = {{'.git', '.venv', 'node_modules', '__pycache__'}}

for root, dirs, files in os.walk('.'):
    # Prune skip directories in place
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
        # Scan common source/config/documentation files
        if f.endswith(('.py', '.json', '.md', '.sql', '.js', '.ts', '.html', '.css', '.env', '.env.local', '.env.example')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                
                new_content = content
                modified = False
                for target, replacement in replacements.items():
                    if target in new_content:
                        new_content = new_content.replace(target, replacement)
                        modified = True
                
                if modified:
                    # Write back to file
                    with open(p, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    print(f"Purged secrets from {{p}}")
            except Exception as e:
                # Silently ignore binary/read errors
                pass
"""

def run_command(args, check=True):
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=check, encoding="utf-8", errors="ignore")
        return result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        print(f"Error running {' '.join(args)}:")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        if check:
            sys.exit(1)
    except FileNotFoundError:
        print(f"Error: Program '{args[0]}' not found.", file=sys.stderr)
        sys.exit(1)

def main():
    print("=" * 60)
    print("Git History Secrets Purger")
    print("=" * 60)
    print("This script will rewrite your Git history to completely purge the following passwords:")
    for k, v in REPLACEMENTS.items():
        print(f"  - '{k}' will be replaced with '{v}'")
    print("\nWARNING: This is a destructive operation that will rewrite all commit hashes.")
    print("Make sure you have committed or stashed any uncommitted local changes before running this.\n")
    
    # Check if git is available
    run_command(["git", "--version"])
    
    # Check if working tree is clean
    stdout, _ = run_command(["git", "status", "--porcelain"])
    if stdout.strip():
        print("[WARNING] Your working directory is not clean. Please stash or commit your changes first.")
        confirm = input("Do you want to continue anyway? (y/N): ")
        if confirm.lower() != 'y':
            print("Aborted.")
            sys.exit(0)
            
    # Write the replacement helper to a temporary file
    temp_dir = tempfile.gettempdir()
    temp_script_path = os.path.join(temp_dir, "git_replace_secrets.py").replace("\\", "/")
    
    script_code = TEMP_SCRIPT_CONTENT.format(replacements_dict=repr(REPLACEMENTS))
    
    with open(temp_script_path, "w", encoding="utf-8") as f:
        f.write(script_code)
        
    print(f"Created temporary helper script at: {temp_script_path}")
    
    # Build filter-branch command
    # We use python to run the temp script on every commit
    cmd = [
        "git", "filter-branch", "--force",
        "--tree-filter", f"python \"{temp_script_path}\"",
        "--prune-empty", "--", "--all"
    ]
    
    print("\nRunning git filter-branch. This may take some time depending on your history size...")
    run_command(cmd)
    
    # Clean up the temporary file
    try:
        os.remove(temp_script_path)
    except Exception:
        pass
        
    print("\nHistory rewrite successful! Now running clean up to remove original references...")
    
    # Clean up original refs (backup created by filter-branch)
    run_command(["git", "update-ref", "-d", "refs/original/refs/heads/main"], check=False)
    run_command(["git", "reflog", "expire", "--expire=now", "--all"])
    run_command(["git", "gc", "--prune=now", "--aggressive"])
    
    print("\n" + "=" * 60)
    print("SUCCESS: Your local Git history has been successfully purged of the sensitive passwords!")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Run 'python scan_git_history.py' to verify that no leaks remain.")
    print("2. To update your remote repository on GitHub, run:")
    print("   git push origin main --force")
    print("\nNote: Anyone else who has cloned this repository will need to re-clone it or do a hard reset.")

if __name__ == "__main__":
    main()
