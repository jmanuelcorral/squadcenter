# Squad Center — APT Repository

This directory contains the infrastructure for hosting Squad Center's Debian apt repository on GitHub Pages.

## How It Works

The `setup.sh` script uses [reprepro](https://wiki.debian.org/SettingUpSignedApt) to build a signed apt repository from the `.deb` package produced by electron-builder. The resulting repository files are deployed to GitHub Pages (`gh-pages` branch), making Squad Center installable via `apt`.

## User Installation

```bash
# Add the GPG key
curl -fsSL https://jmanuelcorral.github.io/squadcenter/gpg-key.public \
  | sudo gpg --dearmor -o /usr/share/keyrings/squad-center.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/squad-center.gpg] https://jmanuelcorral.github.io/squadcenter/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/squad-center.list

# Install
sudo apt update && sudo apt install squad-center
```

## Running Locally (for testing)

Prerequisites: Linux with `reprepro`, `gpg`, and `curl` installed.

```bash
# Generate a test GPG key (if you don't have one)
gpg --batch --gen-key <<EOF
%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: Squad Center
Name-Email: test@example.com
Expire-Date: 0
EOF

# Run setup
VERSION=0.1.1 ./setup.sh
```

The script outputs the deploy-ready files to `/tmp/apt-deploy/`.

## Required Secrets (CI)

| Secret             | Description                                       |
|--------------------|---------------------------------------------------|
| `GPG_PRIVATE_KEY`  | ASCII-armored GPG private key for signing packages |
| `GPG_PASSPHRASE`   | Passphrase for the GPG key (if any)                |

## Directory Structure

```
apt-repo/
├── conf/
│   ├── distributions   # reprepro distribution config
│   └── options         # reprepro options
├── setup.sh            # CI build script
└── README.md           # This file
```
