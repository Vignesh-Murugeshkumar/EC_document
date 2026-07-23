import subprocess
import re
import sys

# Define sensitive regex patterns to search for
SENSITIVE_PATTERNS = [
    r"Vicky@20\d\d",
    r"scattofot@20\d\d",
]

# Exact strings we definitely want to flag
EXACT_KEYWORDS = [
    "Vicky@2077",
    "Vicky@2007",
    "scattofot@2007",
]

def run_git_command(args):
    try:
        result = subprocess.run(["git"] + args, capture_output=True, text=True, check=True, encoding="utf-8", errors="ignore")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running git {' '.join(args)}: {e.stderr}", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("Error: 'git' executable not found. Make sure Git is installed and in your PATH.", file=sys.stderr)
        sys.exit(1)

def main():
    print("=" * 60)
    print("Git History Security Scanner")
    print("=" * 60)
    
    # Get all commit hashes
    print("Fetching commit list...")
    commits_output = run_git_command(["log", "--format=%H"])
    if not commits_output:
        print("No commits found or error occurred.")
        return
        
    commits = commits_output.strip().split("\n")
    print(f"Found {len(commits)} commits to scan.\n")
    
    flagged_commits = 0
    for idx, commit in enumerate(commits, 1):
        print(f"\rScanning commit {idx}/{len(commits)} ({commit[:8]})...", end="", flush=True)
        
        # Get commit diff and metadata
        show_output = run_git_command(["show", "--format=%B", commit])
        if not show_output:
            continue
            
        # We check both the commit message and the diff content
        lines = show_output.split("\n")
        
        found_leaks = []
        for line_no, line in enumerate(lines, 1):
            # Check exact keywords
            for keyword in EXACT_KEYWORDS:
                if keyword in line:
                    found_leaks.append((line_no, line, f"Exact match for '{keyword}'"))
            # Check regex patterns
            for pattern in SENSITIVE_PATTERNS:
                matches = re.findall(pattern, line)
                if matches:
                    found_leaks.append((line_no, line, f"Regex pattern match: '{pattern}'"))
                    
        if found_leaks:
            flagged_commits += 1
            print(f"\n\n[ALERT] Found potential sensitive data in commit {commit[:8]}:")
            # Get commit message and author info
            info = run_git_command(["log", "-1", "--format=Author: %an <%ae>%nDate: %ad%nSubject: %s", commit])
            if info:
                print(info.strip())
            print("Occurrences:")
            for line_no, line, desc in found_leaks:
                # Truncate long lines to avoid flooding output
                disp_line = line.strip()
                if len(disp_line) > 100:
                    disp_line = disp_line[:100] + "... [TRUNCATED]"
                print(f"  Line {line_no}: {desc}")
                print(f"    Content: {disp_line}")
            print("-" * 60)
            
    print(f"\n\nScan completed. Flagged {flagged_commits} out of {len(commits)} commits.")
    if flagged_commits > 0:
        print("Please run 'purge_git_secrets.py' to remove these secrets from the history.")
    else:
        print("No secrets detected in the Git history.")

if __name__ == "__main__":
    main()
