#!/bin/bash

# RefBoard를 refboard-website 리포지토리에 배포하는 스크립트

echo "🔨 Building RefBoard for web..."
npm run build:web

if [ ! -d "dist-web" ]; then
    echo "❌ Build failed! dist-web folder not found."
    exit 1
fi

echo "✅ Build completed!"

# refboard-website 리포지토리 경로 설정
WEBSITE_REPO="../refboard-website"

if [ ! -d "$WEBSITE_REPO" ]; then
    echo "❌ refboard-website repository not found at $WEBSITE_REPO"
    echo "Please clone the repository or update the WEBSITE_REPO path in this script."
    exit 1
fi

echo "📦 Copying files to $WEBSITE_REPO..."

# dist-web의 모든 내용을 refboard 폴더로 복사
mkdir -p "$WEBSITE_REPO/refboard"
cp -r dist-web/* "$WEBSITE_REPO/refboard/"

echo "✅ Files copied successfully!"
echo ""
echo "Next steps:"
echo "1. cd $WEBSITE_REPO"
echo "2. git add refboard/"
echo "3. git commit -m 'Deploy RefBoard app'"
echo "4. git push origin main"





