# Quickstart Guide: Google Gemini Multi-Image Analysis Web App

**Purpose**: Step-by-step validation scenarios for user story verification  
**Date**: 2025-09-10  
**Status**: Ready for testing implementation

## Overview

This guide provides executable test scenarios that validate the complete user journey from image upload to analysis results. Each scenario corresponds to acceptance criteria from the feature specification.

## Prerequisites

### Development Environment
- Node.js 18+ installed
- Docker and Docker Compose (optional)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google Gemini API key (for backend testing)

### Test Data
Prepare test images in different formats:
- `test-image-1.jpg` (2MB, 1920x1080, landscape photo)
- `test-image-2.png` (1.5MB, 800x600, screenshot with text)
- `test-image-3.webp` (800KB, 1024x1024, graphic design)
- `test-image-4.gif` (3MB, 500x300, animated gif for static analysis)
- `test-large.jpg` (6MB, 4000x3000, exceeds size limit)

## Scenario 1: Basic Multi-Image Analysis

**Objective**: Validate core functionality with multiple images and descriptive prompt

### Steps
1. **Setup**
   ```bash
   # Start development servers
   cd backend && npm run dev
   cd frontend && npm start
   
   # Open browser to http://localhost:3000
   ```

2. **Image Upload**
   - Drag and drop `test-image-1.jpg` and `test-image-2.png` into upload area
   - Verify upload progress indicators appear
   - Verify thumbnails display with file names and sizes
   - Check that both images show "ready" status

3. **Prompt Input**
   ```
   Describe what you see in these images and identify any common themes or differences between them.
   ```

4. **Analysis Execution**
   - Click "Analyze Images" button
   - Verify loading spinner appears
   - Verify estimated completion time displays (should be <10s)
   - Wait for results to appear

5. **Expected Results**
   - Analysis completes within 10 seconds
   - Results display in readable markdown format
   - Each image has individual analysis section
   - Common themes/differences are identified
   - No error messages appear

### Success Criteria
✅ Multiple images upload successfully  
✅ Prompt accepts descriptive text  
✅ Analysis returns structured results  
✅ Response time under 10 seconds  
✅ Results address prompt requirements  

## Scenario 2: Comparative Analysis

**Objective**: Validate comparative analysis with specific questioning prompt

### Steps
1. **Image Upload**
   - Upload `test-image-1.jpg` (landscape photo)
   - Upload `test-image-3.webp` (graphic design)
   - Verify both images are ready for analysis

2. **Comparative Prompt**
   ```
   Compare and contrast these two images. What are the main visual differences in style, content, and composition? Which image would be more suitable for a website header?
   ```

3. **Analysis Execution**
   - Submit analysis request
   - Monitor processing status

4. **Expected Results**
   - Direct comparison between the two images
   - Style analysis (photographic vs. graphic design)
   - Content differences identified
   - Composition analysis provided
   - Website header suitability recommendation
   - Reasoning for recommendation given

### Success Criteria
✅ Comparative analysis addresses specific questions  
✅ Style differences clearly identified  
✅ Content comparison provided  
✅ Practical recommendation given with reasoning  

## Scenario 3: Edge Case - File Size Limits

**Objective**: Validate file size validation and error handling

### Steps
1. **Large File Upload Attempt**
   - Attempt to drag `test-large.jpg` (6MB) into upload area
   - Verify immediate client-side validation error
   - Error message should indicate 5MB limit

2. **Multiple Files Exceeding Total Limit**
   - Upload 4 images of 4.5MB each (simulate total >20MB)
   - Attempt to add 5th image
   - Verify total size validation triggers

3. **Expected Error Handling**
   - Clear error messages displayed
   - Upload process stops gracefully
   - User can remove images and retry
   - No server requests sent for invalid files

### Success Criteria
✅ Client-side validation prevents oversized uploads  
✅ Clear error messages guide user action  
✅ Graceful error recovery possible  
✅ No unnecessary server requests  

## Scenario 4: Unsupported File Formats

**Objective**: Validate file format restrictions and error handling

### Steps
1. **Invalid Format Upload**
   - Attempt to upload `test-document.pdf`
   - Attempt to upload `test-video.mp4`
   - Attempt to upload `test-audio.mp3`

2. **Expected Behavior**
   - Files rejected at client-side validation
   - Error message lists supported formats
   - Upload area remains available for valid files

### Success Criteria
✅ Only image formats accepted  
✅ Clear format requirements communicated  
✅ Immediate validation feedback provided  

## Scenario 5: Empty and Invalid Prompts

**Objective**: Validate prompt input validation

### Steps
1. **Empty Prompt**
   - Upload 2 valid images
   - Leave prompt field empty
   - Attempt to submit analysis

2. **Extremely Long Prompt**
   - Enter prompt text exceeding 2000 characters
   - Attempt to submit

3. **Expected Validation**
   - Empty prompt error: "Prompt is required"
   - Long prompt error: "Prompt must be under 2000 characters"
   - Character count indicator updates in real-time
   - Submit button disabled until valid

### Success Criteria
✅ Empty prompts rejected with clear error  
✅ Overly long prompts truncated or rejected  
✅ Real-time validation feedback  
✅ Submit button state reflects validation  

## Scenario 6: API Rate Limiting

**Objective**: Validate rate limit handling and user feedback

### Steps
1. **Rapid Request Submission**
   - Submit analysis request
   - Immediately submit another request
   - Continue until rate limit reached (10 requests/minute)

2. **Expected Rate Limit Behavior**
   - Request queue with position indicator
   - Estimated wait time displayed
   - Graceful queuing rather than rejection
   - Clear status updates

### Success Criteria
✅ Rate limiting enforced but user-friendly  
✅ Queue position and wait times shown  
✅ No requests lost or failed silently  
✅ User can cancel queued requests  

## Scenario 7: Session Persistence

**Objective**: Validate session-based result history

### Steps
1. **Multiple Analysis Sessions**
   - Complete 3 different image analyses
   - Navigate away from page and return
   - Verify analysis history preserved

2. **Result Export**
   - Select previous analysis result
   - Export as JSON format
   - Export as Markdown format
   - Verify downloaded files contain complete data

### Success Criteria
✅ Session history persists across page reloads  
✅ Previous results accessible and complete  
✅ Export functionality works for multiple formats  
✅ Exported data includes all analysis details  

## Scenario 8: Error Recovery

**Objective**: Validate error handling and recovery mechanisms

### Steps
1. **Network Interruption Simulation**
   - Start image upload
   - Disconnect network mid-upload
   - Reconnect network
   - Verify retry mechanism

2. **API Service Unavailable**
   - Submit analysis with mocked API error
   - Verify error message and retry options
   - Check that images and prompt are preserved

### Success Criteria
✅ Network errors handled gracefully  
✅ User data preserved during errors  
✅ Clear error messages with recovery actions  
✅ Automatic retry mechanisms work  

## Performance Benchmarks

### Response Time Targets
- Image upload: <3 seconds per image
- Analysis processing: <10 seconds total
- Result display: <1 second after API response
- Page load: <2 seconds (initial + assets)

### Resource Usage Limits
- Client memory: <100MB for 5 images
- Network usage: <25MB per analysis session
- Storage: No persistent client-side storage
- API calls: Stay within free tier limits

### Browser Compatibility
- Chrome 90+: Full functionality
- Firefox 90+: Full functionality  
- Safari 14+: Full functionality
- Edge 90+: Full functionality

## Test Automation

### Unit Test Coverage
```bash
# Backend API tests
cd backend && npm test

# Frontend component tests  
cd frontend && npm test
```

### Integration Test Suite
```bash
# End-to-end scenarios
npm run test:e2e
```

### Performance Testing
```bash
# Load testing with lighthouse
npm run test:performance
```

## Troubleshooting

### Common Issues
1. **Images not uploading**: Check file size and format
2. **Analysis timing out**: Verify API key and network connection
3. **Results not displaying**: Check browser console for JavaScript errors
4. **Rate limit errors**: Wait for rate limit reset or upgrade API tier

### Debug Information
- Browser console logs for client-side debugging
- Server logs for API request/response details
- Network tab for upload progress and API calls
- Performance tab for response time analysis

## Success Metrics

**User Experience**:
- Upload success rate >95%
- Analysis completion rate >90%  
- Error recovery rate >80%
- User session completion >85%

**Performance**:
- Average upload time <3s
- Average analysis time <8s
- Error rate <5%
- Browser compatibility >95%

**API Usage**:
- Stay within free tier limits
- Efficient token usage
- Minimal redundant requests
- Proper error handling

---

**Next Steps**: Use this quickstart guide to validate implementation during development and create automated test suites for continuous integration.