#!/bin/bash

# GCE 서버 초기 설정 스크립트
# GCE 인스턴스에 처음 접속했을 때 실행하는 스크립트

set -e

echo "🛠️  GCE 서버 초기 설정 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 시스템 업데이트
echo "📦 시스템 업데이트 중..."
sudo apt-get update
sudo apt-get upgrade -y

# Docker 설치
echo "🐳 Docker 설치 중..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker 설치 완료${NC}"
else
    echo -e "${YELLOW}⚠️  Docker가 이미 설치되어 있습니다.${NC}"
fi

# Docker Compose 설치
echo "🔧 Docker Compose 설치 중..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install docker-compose-plugin -y
    echo -e "${GREEN}✅ Docker Compose 설치 완료${NC}"
else
    echo -e "${YELLOW}⚠️  Docker Compose가 이미 설치되어 있습니다.${NC}"
fi

# 현재 사용자를 docker 그룹에 추가
echo "👤 사용자 권한 설정 중..."
sudo usermod -aG docker $USER

# Git 설치
echo "📚 Git 설치 중..."
if ! command -v git &> /dev/null; then
    sudo apt-get install git -y
    echo -e "${GREEN}✅ Git 설치 완료${NC}"
else
    echo -e "${YELLOW}⚠️  Git이 이미 설치되어 있습니다.${NC}"
fi

# 방화벽 설정 (UFW)
echo "🔥 방화벽 설정 중..."
sudo apt-get install ufw -y

# SSH 허용
sudo ufw allow 22/tcp

# HTTP 허용
sudo ufw allow 80/tcp

# API 포트 허용
sudo ufw allow 3000/tcp

# 방화벽 활성화 (이미 활성화되어 있을 수 있음)
echo "y" | sudo ufw enable || true

echo ""
echo -e "${GREEN}🎉 서버 설정 완료!${NC}"
echo ""
echo "⚠️  중요: Docker 그룹 변경사항을 적용하려면 로그아웃 후 다시 로그인하세요:"
echo "   exit"
echo "   # 다시 SSH 접속"
echo ""
echo "📝 다음 단계:"
echo "   1. 재로그인 후 GitHub에서 프로젝트 클론:"
echo "      git clone YOUR_REPO_URL nano"
echo "      cd nano"
echo ""
echo "   2. 환경 변수 설정:"
echo "      cp .env.production.example .env.production"
echo "      nano .env.production"
echo ""
echo "   3. 배포 스크립트 실행:"
echo "      ./scripts/deploy-gce.sh"
echo ""
echo "📚 자세한 내용은 docs/DEPLOYMENT.md를 참고하세요."
