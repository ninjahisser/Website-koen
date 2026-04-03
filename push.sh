#!/bin/bash
# Git Push Script for Website-koen
# Run this script to quickly push changes to GitHub

echo "=========================================="
echo "Website-koen - Git Push Script"
echo "=========================================="
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed or not in PATH"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Not in a git repository. Run this from the project root."
    exit 1
fi

# Show git status
echo "📊 Current status:"
git status --short
echo ""

# Get commit message from user
read -p "📝 Commit message: " commit_message

if [ -z "$commit_message" ]; then
    echo "❌ Commit message cannot be empty"
    exit 1
fi

# Add all changes
echo ""
echo "📦 Staging changes..."
git add .

# Commit changes
echo "💾 Creating commit..."
if git commit -m "$commit_message"; then
    echo "✅ Commit created"
else
    echo "⚠️  Nothing to commit (working tree clean)"
fi

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
if git push; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
else
    echo "❌ Push failed. Check your connection and credentials."
    exit 1
fi

echo ""
echo "=========================================="
