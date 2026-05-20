# Media Asset Production Guide

## Current Asset Inventory

### Existing Assets
```
assets/
├── Backgrounds/          # 5 background images (existing)
│   ├── blue red.png
│   ├── blue.png
│   ├── brown pink.png
│   ├── brown.png
│   └── cyan green.png
├── Insta_Ads/            # 3 video ads (existing)
├── Logo/                 # 6 logo variations (existing)
└── Shoe_Design/          # 8 shoe designs (existing)
```

---

## 1. HD Product Images - Multiple Angles

**Status:** [ ] Not Started

### Requirements
| Spec | Value |
|------|-------|
| Resolution | 3000×3000px minimum |
| Format | PNG with transparent background |
| File Size | <500KB per image |
| Lighting | Soft, diffused lighting |
| Total Images | 40 (5 products × 8 angles) |

### Products to Photograph

#### Nike Drops (Blue)
Save to: `Products/Nike_Drops/`
- [ ] `front.png` - Front view
- [ ] `back.png` - Back view
- [ ] `left.png` - Left side
- [ ] `right.png` - Right side
- [ ] `top.png` - Top down
- [ ] `bottom.png` - Sole view
- [ ] `angle-front-left.png` - 45° front-left
- [ ] `angle-front-right.png` - 45° front-right

#### Golden ESSENCE (Gold/Black)
Save to: `Products/Golden_ESSENCE/`
- [ ] `front.png`
- [ ] `back.png`
- [ ] `left.png`
- [ ] `right.png`
- [ ] `top.png`
- [ ] `bottom.png`
- [ ] `angle-front-left.png`
- [ ] `angle-front-right.png`

#### Pink Panda (Pastel Pink)
Save to: `Products/Pink_Panda/`
- [ ] `front.png`
- [ ] `back.png`
- [ ] `left.png`
- [ ] `right.png`
- [ ] `top.png`
- [ ] `bottom.png`
- [ ] `angle-front-left.png`
- [ ] `angle-front-right.png`

#### Browny CLASSIC (Brown)
Save to: `Products/Browny_CLASSIC/`
- [ ] `front.png`
- [ ] `back.png`
- [ ] `left.png`
- [ ] `right.png`
- [ ] `top.png`
- [ ] `bottom.png`
- [ ] `angle-front-left.png`
- [ ] `angle-front-right.png`

#### LAB DOOR SPORT (Brown-Pink)
Save to: `Products/LAB_DOOR_SPORT/`
- [ ] `front.png`
- [ ] `back.png`
- [ ] `left.png`
- [ ] `right.png`
- [ ] `top.png`
- [ ] `bottom.png`
- [ ] `angle-front-left.png`
- [ ] `angle-front-right.png`

### Photography Setup Tips
1. Use a turntable for consistent angles
2. White seamless backdrop for easy background removal
3. Three-point lighting setup
4. Camera at shoe eye-level
5. Use a tripod for sharpness

---

## 2. 360° Revolving Product Videos

**Status:** [ ] Not Started

### Requirements
| Spec | Value |
|------|-------|
| Resolution | 1920×1080 (FHD) |
| Frame Rate | 30 FPS |
| Format | MP4 (H.264 codec) |
| File Size | <10MB per video |
| Duration | 10-15 seconds |
| Rotation | Full 360° |

### Videos to Create
Save to: `Videos/360_Spins/`

- [ ] `nike-drops-360.mp4`
- [ ] `golden-essence-360.mp4`
- [ ] `pink-panda-360.mp4`
- [ ] `browny-classic-360.mp4`
- [ ] `lab-door-sport-360.mp4`

### Production Tips
1. Use motorized turntable (10-15s per rotation)
2. Lock camera on tripod
3. Shoot in well-lit studio
4. Post-process: stabilize, color grade, loop seamlessly

---

## 3. Post-Processing Checklist

**Status:** [ ] Not Started

### For Each Product Image:
- [ ] Remove background (Photoshop, remove.bg, or Canva)
- [ ] Color correction (match actual product colors)
- [ ] Exposure/contrast adjustment
- [ ] Sharpening
- [ ] Export as PNG with transparency
- [ ] Optimize file size (TinyPNG, Squoosh)
- [ ] Verify dimensions (3000×3000px)

### Tools Recommended:
- **Background Removal:** remove.bg, Photoshop, Canva Pro
- **Color Correction:** Lightroom, Photoshop, GIMP
- **Optimization:** TinyPNG, Squoosh, ImageOptim

---

## 4. HD Background Images

**Status:** [x] Partially Complete (5 backgrounds exist)

### Requirements
| Spec | Value |
|------|-------|
| Resolution | 1920×1080 FHD minimum |
| Format | PNG or JPEG |
| File Size | <300KB |
| Style | Abstract gradient matching shoe colors |

### Backgrounds Needed
Save to: `Backgrounds/`

| Product | Color Theme | Status |
|---------|-------------|--------|
| Nike Drops | Blue gradient | [x] `blue.png` exists |
| Golden ESSENCE | Gold/amber gradient | [ ] Need gold version |
| Pink Panda | Pink/pastel gradient | [ ] Check `brown pink.png` |
| Browny CLASSIC | Brown/earth tones | [x] `brown.png` exists |
| LAB DOOR SPORT | Brown-pink blend | [x] `brown pink.png` exists |

### Background Style Guide
- Soft gradients, not harsh
- Subtle texture or bokeh effects
- Colors should complement, not compete with product
- Dark enough for white text overlay

---

## 5. Instagram Reels/Stories Ads

**Status:** [ ] Partially Started (3 videos in Insta_Ads/)

### Requirements
| Spec | Value |
|------|-------|
| Aspect Ratio | 9:16 (vertical) |
| Resolution | 1080×1920 |
| Format | MP4 (H.264) |
| File Size | <30MB |

### Videos to Create
Save to: `Videos/Reels/`

| Video Type | Duration | Description | Status |
|------------|----------|-------------|--------|
| Showcase Carousel | 15s | All 5 products quick cuts | [ ] |
| 360° Spin Compilation | 10s | Best product spinning | [ ] |
| Lifestyle/Action | 20-30s | People wearing shoes | [ ] |
| Unboxing Experience | 15-20s | Premium unboxing | [ ] |
| Customer Testimonial | 15s | Real customer review | [ ] |
| Flash Sale Promo | 10s | Limited time offer | [ ] |

### Creative Guidelines
- Hook in first 1-2 seconds
- Include brand logo
- Add captions (80% watch muted)
- End with clear CTA
- Use trending audio when appropriate

---

## 6. Facebook/Instagram Feed Ads

**Status:** [ ] Not Started

### Requirements
| Spec | Value |
|------|-------|
| Aspect Ratio | 1:1 (square) or 4:5 |
| Resolution | 1080×1080 or 1080×1350 |
| Format | PNG/JPEG for images, MP4 for video |
| Text | <20% of image area |

### Ads to Create
Save to: `Social_Ads/`

#### Single Image Ads (5)
Save to: `Social_Ads/Instagram/`
- [ ] `nike-drops-ad.png`
- [ ] `golden-essence-ad.png`
- [ ] `pink-panda-ad.png`
- [ ] `browny-classic-ad.png`
- [ ] `lab-door-sport-ad.png`

#### Carousel Ad (1)
Save to: `Social_Ads/Facebook/`
- [ ] `carousel-1.png` - Hero shot
- [ ] `carousel-2.png` - Product 1
- [ ] `carousel-3.png` - Product 2
- [ ] `carousel-4.png` - Product 3
- [ ] `carousel-5.png` - CTA slide

### Ad Copy Templates

**Single Product Ad:**
```
[Product Name] - Handcrafted Excellence

Premium leather. Timeless design. Made for you.

Shop now and get FREE shipping on orders over $100

[Shop Now Button]
```

**Carousel Ad:**
```
Slide 1: "Discover Your Perfect Pair"
Slide 2-4: Individual product features
Slide 5: "Shop the Collection - Link in Bio"
```

---

## File Naming Convention

```
[product-name]-[angle/type]-[size].[extension]

Examples:
- nike-drops-front.png
- golden-essence-360.mp4
- pink-panda-ad-square.png
- carousel-slide-1.png
```

---

## Folder Structure Summary

```
frontend/src/assets/
├── Backgrounds/           # Gradient backgrounds
├── Insta_Ads/            # Existing video ads
├── Logo/                 # Brand logos
├── Shoe_Design/          # Current shoe images
├── Products/             # NEW: Multi-angle product shots
│   ├── Nike_Drops/
│   ├── Golden_ESSENCE/
│   ├── Pink_Panda/
│   ├── Browny_CLASSIC/
│   └── LAB_DOOR_SPORT/
├── Videos/               # NEW: Video content
│   ├── 360_Spins/
│   └── Reels/
└── Social_Ads/           # NEW: Social media ads
    ├── Instagram/
    └── Facebook/
```

---

## Production Timeline Estimate

| Task | Items | Est. Time |
|------|-------|-----------|
| Product Photography | 40 images | 1-2 days |
| Background Removal | 40 images | 4-6 hours |
| Color Correction | 40 images | 2-3 hours |
| 360° Videos | 5 videos | 1 day |
| Video Post-Processing | 5 videos | 4-6 hours |
| Social Ad Design | 6 ads | 1 day |
| Reels/Stories | 6 videos | 2-3 days |

**Total Estimated Time: 7-10 days**

---

## Tools & Resources

### Photography
- Camera: DSLR or mirrorless (or high-end smartphone)
- Lighting: Softbox lights or ring light
- Background: White seamless paper
- Turntable: Motorized for 360° videos

### Software
- **Photo Editing:** Adobe Photoshop, Lightroom, GIMP
- **Video Editing:** Adobe Premiere, DaVinci Resolve, CapCut
- **Background Removal:** remove.bg, Canva Pro
- **Image Optimization:** TinyPNG, Squoosh
- **Social Ad Design:** Canva, Adobe Express, Figma

### Stock Resources
- Pexels, Unsplash (lifestyle photos)
- Envato Elements (templates)
- Adobe Stock (premium assets)
