# Google Compute Engine 배포 가이드

## 📋 사전 준비사항

### 1. GCE 인스턴스 설정
- **권장 사양**: e2-medium (2 vCPU, 4GB RAM) 이상
- **OS**: Ubuntu 22.04 LTS
- **디스크**: 20GB 이상
- **방화벽 규칙**:
  - HTTP (80)
  - Custom TCP (3000) - API 서버용
  - SSH (22) - 관리용

### 2. 필요한 도구
- Docker
- Docker Compose
- Git

## 🚀 배포 단계

### 1단계: GCE 인스턴스 생성 및 접속

```bash
# SSH로 GCE 인스턴스 접속
gcloud compute ssh YOUR_INSTANCE_NAME --zone=YOUR_ZONE
```

### 2단계: 서버 환경 설정

```bash
# 시스템 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo apt-get install docker-compose-plugin -y

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 변경사항 적용을 위해 재로그인
exit
# 다시 SSH 접속
```

### 3단계: 프로젝트 클론 및 설정

```bash
# Git 설치 (필요시)
sudo apt-get install git -y

# 프로젝트 클론
git clone YOUR_GITHUB_REPO_URL nano
cd nano

# 환경 변수 파일 생성
cp .env.production.example .env.production

# 환경 변수 편집
nano .env.production
```

**필수 설정값:**
```bash
# Gemini API 키 입력 (필수)
GEMINI_API_KEY=your_actual_api_key

# GCE 인스턴스의 외부 IP 입력
REACT_APP_API_URL=http://YOUR_GCE_EXTERNAL_IP:3000

# 강력한 세션 시크릿 생성 (32자 이상)
SESSION_SECRET=$(openssl rand -base64 32)
```

### 4단계: 애플리케이션 빌드 및 실행

```bash
# Docker 이미지 빌드
docker compose -f docker-compose.prod.yml build

# 컨테이너 실행 (백그라운드)
docker compose -f docker-compose.prod.yml up -d

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f
```

### 5단계: 동작 확인

```bash
# 헬스 체크
curl http://localhost:3000/health

# 브라우저에서 접속
# http://YOUR_GCE_EXTERNAL_IP
```

## 🔒 보안 설정 (권장)

### 1. 방화벽 규칙 설정

```bash
# GCE 방화벽 규칙에서 회사 IP만 허용
# Cloud Console > VPC network > Firewall rules 에서 설정
# Source IP ranges: YOUR_COMPANY_IP_RANGE
```

### 2. HTTPS 설정 (선택사항)

```bash
# Certbot 설치 (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx -y

# SSL 인증서 발급 (도메인이 있는 경우)
sudo certbot --nginx -d yourdomain.com
```

### 3. 환경 변수 보호

```bash
# .env.production 파일 권한 제한
chmod 600 .env.production
```

## 📊 모니터링 및 관리

### 컨테이너 상태 확인
```bash
docker compose -f docker-compose.prod.yml ps
```

### 로그 확인
```bash
# 전체 로그
docker compose -f docker-compose.prod.yml logs

# 특정 서비스 로그
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs frontend

# 실시간 로그 추적
docker compose -f docker-compose.prod.yml logs -f
```

### 애플리케이션 재시작
```bash
# 모든 서비스 재시작
docker compose -f docker-compose.prod.yml restart

# 특정 서비스만 재시작
docker compose -f docker-compose.prod.yml restart backend
```

### 애플리케이션 중지
```bash
docker compose -f docker-compose.prod.yml down
```

### 업데이트 배포
```bash
# 최신 코드 가져오기
git pull

# 환경 변수 확인/업데이트
nano .env.production

# 재빌드 및 재시작
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## 🔧 문제 해결

### 컨테이너가 시작되지 않는 경우
```bash
# 로그 확인
docker compose -f docker-compose.prod.yml logs

# 개별 컨테이너 상태 확인
docker ps -a

# 특정 컨테이너 로그 확인
docker logs nano-backend-1
```

### 디스크 공간 부족
```bash
# 사용하지 않는 Docker 리소스 정리
docker system prune -a

# 볼륨 확인
docker volume ls
```

### 성능 문제
```bash
# 리소스 사용량 확인
docker stats

# GCE 인스턴스 모니터링
gcloud compute instances describe YOUR_INSTANCE_NAME
```

## 📝 유지보수 팁

1. **정기 백업**: Redis 데이터와 업로드된 파일 백업
   ```bash
   # Redis 데이터 백업
   docker exec nano-redis-1 redis-cli BGSAVE

   # 백업 파일 복사
   docker cp nano-redis-1:/data/dump.rdb ./backup/
   ```

2. **로그 관리**: 오래된 로그 정리
   ```bash
   # 7일 이상 된 로그 삭제
   cd nano/backend && npm run logs:clean:weekly
   ```

3. **보안 업데이트**: 정기적인 시스템 업데이트
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

4. **모니터링 설정**: GCP Cloud Monitoring 활용

## 🌐 팀원 접근 관리

### VPC 방화벽 규칙 (회사 IP만 허용)
```bash
# Cloud Console에서 설정
# VPC network > Firewall rules > Create Firewall Rule
# - Source IP ranges: YOUR_COMPANY_IP/32
# - Target tags: http-server
# - Protocols: tcp:80,tcp:3000
```

### 사용자 가이드 제공
팀원들에게 다음 정보 공유:
- 접속 URL: `http://YOUR_GCE_IP`
- API 엔드포인트: `http://YOUR_GCE_IP:3000`
- 사용 제한: 이미지 5개, 최대 5MB/개

## 📞 지원

문제 발생 시:
1. 로그 확인: `docker compose -f docker-compose.prod.yml logs`
2. 상태 확인: `docker compose -f docker-compose.prod.yml ps`
3. GitHub Issues에 문의
