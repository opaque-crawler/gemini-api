#!/bin/bash

# Google Compute Engine 배포 스크립트
# 사용법: ./scripts/deploy-gce.sh

set -e

echo "🚀 Nano 프로젝트 GCE 배포 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 환경 변수 파일 확인
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production 파일이 없습니다.${NC}"
    echo "📝 .env.production.example 파일을 복사하여 .env.production을 생성하고 값을 입력하세요:"
    echo "   cp .env.production.example .env.production"
    echo "   nano .env.production"
    exit 1
fi

# 필수 환경 변수 확인
source .env.production

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" == "your_actual_gemini_api_key_here" ]; then
    echo -e "${RED}❌ GEMINI_API_KEY가 설정되지 않았습니다.${NC}"
    echo "📝 .env.production 파일에서 실제 API 키를 설정하세요."
    exit 1
fi

if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" == "your_very_strong_random_secret_here_minimum_32_characters" ]; then
    echo -e "${YELLOW}⚠️  SESSION_SECRET가 기본값입니다. 강력한 시크릿으로 변경을 권장합니다.${NC}"
    echo "💡 다음 명령으로 생성 가능: openssl rand -base64 32"
    read -p "계속하시겠습니까? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker가 설치되지 않았습니다.${NC}"
    echo "📝 다음 명령으로 설치하세요:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    exit 1
fi

# Docker Compose 설치 확인
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose가 설치되지 않았습니다.${NC}"
    echo "📝 다음 명령으로 설치하세요:"
    echo "   sudo apt-get install docker-compose-plugin -y"
    exit 1
fi

# 기존 컨테이너 중지 (있는 경우)
echo "🛑 기존 컨테이너 중지 중..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Docker 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."
docker compose -f docker-compose.prod.yml build

# 컨테이너 시작
echo "▶️  컨테이너 시작 중..."
docker compose -f docker-compose.prod.yml up -d

# 헬스 체크
echo "🏥 헬스 체크 대기 중..."
sleep 10

# Backend 헬스 체크
if curl -f http://localhost:3000/api/v1/health &> /dev/null; then
    echo -e "${GREEN}✅ Backend 서버 정상 작동${NC}"
else
    echo -e "${RED}❌ Backend 서버 헬스 체크 실패${NC}"
    echo "로그 확인:"
    docker compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Frontend 체크
if curl -f http://localhost:80 &> /dev/null; then
    echo -e "${GREEN}✅ Frontend 서버 정상 작동${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend 서버 체크 실패 (정상일 수 있음)${NC}"
fi

# 컨테이너 상태 확인
echo ""
echo "📊 컨테이너 상태:"
docker compose -f docker-compose.prod.yml ps

# 접속 정보 출력
echo ""
echo -e "${GREEN}🎉 배포 완료!${NC}"
echo ""
echo "📡 접속 정보:"
echo "   Frontend: http://$(curl -s ifconfig.me)"
echo "   Backend API: http://$(curl -s ifconfig.me):3000"
echo ""
echo "📝 유용한 명령어:"
echo "   로그 확인: docker compose -f docker-compose.prod.yml logs -f"
echo "   재시작: docker compose -f docker-compose.prod.yml restart"
echo "   중지: docker compose -f docker-compose.prod.yml down"
echo ""
echo "📚 자세한 내용은 docs/DEPLOYMENT.md를 참고하세요."
