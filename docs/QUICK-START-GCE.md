# ⚡ Google Compute Engine 빠른 배포 가이드


## 📋 체크리스트

배포 전 준비사항:
- [ ] GCE 인스턴스 생성됨 (e2-medium 이상, Ubuntu 22.04)
- [ ] 방화벽 규칙 설정 (80, 3000, 22 포트)
- [ ] Gemini API 키 준비됨
- [ ] GitHub 저장소에 코드 푸시됨

## 🚀 3단계 배포

### 1️⃣ 서버 접속 및 초기 설정 (2분)

```bash
# SSH로 GCE 인스턴스 접속
gcloud compute ssh YOUR_INSTANCE_NAME --zone=YOUR_ZONE

# 또는 GCP Console에서 SSH 버튼 클릭

# 프로젝트 클론
git clone https://github.com/YOUR_USERNAME/nano.git
cd nano

# 서버 자동 설정 (Docker, Git 등)
./scripts/setup-gce-server.sh

# 로그아웃 후 재접속 (Docker 권한 적용)
exit
# SSH 재접속
cd nano
```

### 2️⃣ 환경 변수 설정 (1분)

```bash
# 환경 변수 파일 생성
cp .env.production.example .env.production

# 필수 값 입력
nano .env.production
```

**반드시 수정할 값:**
```env
# 1. Gemini API 키 (필수)
GEMINI_API_KEY=실제_api_키_입력

# 2. 외부 접속 URL (필수)
REACT_APP_API_URL=http://YOUR_GCE_EXTERNAL_IP:3000

# 3. 세션 시크릿 (필수)
SESSION_SECRET=복잡한_랜덤_문자열_32자_이상
```

**세션 시크릿 생성:**
```bash
# 강력한 랜덤 시크릿 생성
openssl rand -base64 32
```

### 3️⃣ 배포 실행 (2분)

```bash
# 자동 배포
./scripts/deploy-gce.sh

# 성공하면 다음과 같이 표시됩니다:
# ✅ Backend 서버 정상 작동
# ✅ Frontend 서버 정상 작동
# 🎉 배포 완료!
```

## 🌐 접속하기

배포가 완료되면:

**팀원들에게 공유할 URL:**
```
http://YOUR_GCE_EXTERNAL_IP
```

**API 엔드포인트:**
```
http://YOUR_GCE_EXTERNAL_IP:3000
```

## 🔍 문제 해결

### 컨테이너가 시작되지 않는 경우

```bash
# 로그 확인
docker compose -f docker-compose.prod.yml logs

# 특정 서비스 로그
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs frontend
```

### 환경 변수 확인

```bash
# .env.production 파일 확인
cat .env.production

# API 키가 제대로 입력되었는지 확인
```

### 재배포

```bash
# 기존 컨테이너 중지 및 재배포
docker compose -f docker-compose.prod.yml down
./scripts/deploy-gce.sh
```

## 🛡️ 보안 강화 (선택사항)

### 회사 IP만 허용

GCP Console에서:
1. **VPC network** > **Firewall rules** 이동
2. 새 규칙 생성:
   - Name: `allow-company-only`
   - Source IP ranges: `회사_IP_주소/32`
   - Protocols: `tcp:80,tcp:3000`
   - Target tags: 인스턴스 태그

### 환경 변수 파일 보호

```bash
# 파일 권한 제한 (소유자만 읽기/쓰기)
chmod 600 .env.production
```

## 📊 모니터링

### 실시간 로그 보기

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### 컨테이너 상태 확인

```bash
docker compose -f docker-compose.prod.yml ps
```

### 리소스 사용량

```bash
docker stats
```

## 🔄 업데이트 배포

코드 변경 후 업데이트:

```bash
# 최신 코드 가져오기
git pull

# 재배포
./scripts/deploy-gce.sh
```

## 💡 팁

### 1. 외부 IP 확인
```bash
curl ifconfig.me
```

### 2. 빠른 재시작
```bash
docker compose -f docker-compose.prod.yml restart
```

### 3. 로그 정리
```bash
# 7일 이상 된 로그 삭제
cd backend && npm run logs:clean:weekly
```

### 4. 디스크 공간 정리
```bash
# 사용하지 않는 Docker 리소스 정리
docker system prune -a
```

## 📞 도움말

- **배포 실패**: [docs/DEPLOYMENT.md](DEPLOYMENT.md) 상세 가이드 참고
- **보안 설정**: [docs/DEPLOYMENT.md#보안-설정](DEPLOYMENT.md#보안-설정)
- **문제 해결**: [docs/DEPLOYMENT.md#문제-해결](DEPLOYMENT.md#문제-해결)

## 📝 다음 단계

배포 완료 후:
- [ ] 팀원들에게 URL 공유
- [ ] 사용 방법 안내 (이미지 5개, 최대 5MB)
- [ ] 주기적인 로그 확인 및 관리
- [ ] 정기적인 보안 업데이트

---

**배포 시간**: 총 5분 소요
**필요 기술 수준**: 기본적인 Linux 명령어 사용 가능하면 OK
