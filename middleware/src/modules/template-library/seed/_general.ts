/**
 * General Templates (12) — Upgraded Design
 * Rich gradients, Google Fonts (Inter + Playfair Display), CSS pseudo-elements,
 * box-shadows, CSS Grid, and polished layouts for digital signage.
 */

import { TemplateSeed } from './template-seeds';

export const generalTemplates: TemplateSeed[] = [
  // 1. Welcome Screen (isFeatured)
  {
    name: 'Welcome Screen',
    description: 'Elegant gradient welcome display with Playfair Display heading and radial glow decoration',
    category: 'general',
    libraryTags: ['welcome', 'greeting', 'lobby'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: true,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.welcome{height:100vh;background:linear-gradient(135deg,#4338ca 0%,#6d28d9 40%,#7c3aed 70%,#a855f7 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}.welcome::before{content:'';position:absolute;top:50%;left:50%;width:60vw;height:60vw;background:radial-gradient(circle,rgba(255,255,255,.12) 0%,transparent 70%);transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}.welcome::after{content:'';position:absolute;bottom:-10vh;right:-5vw;width:40vw;height:40vw;background:radial-gradient(circle,rgba(167,139,250,.3) 0%,transparent 65%);border-radius:50%;pointer-events:none}.welcome .content{position:relative;z-index:1;max-width:80vw}.welcome h1{font-family:'Playfair Display',serif;font-size:7vw;font-weight:900;line-height:1.1;margin-bottom:3vh;text-shadow:0 4px 20px rgba(0,0,0,.2)}.welcome p{font-size:2.8vw;font-weight:300;opacity:.9;letter-spacing:.05em}</style><div class="welcome"><div class="content"><h1>{{greeting}}</h1><p>{{subtitle}}</p></div></div>`,
    sampleData: { greeting: 'Welcome', subtitle: 'We are glad to have you here' },
  },

  // 2. Digital Clock
  {
    name: 'Digital Clock',
    description: 'Minimal digital clock with thin monospace time on pure black background',
    category: 'general',
    libraryTags: ['clock', 'time', 'utility'],
    difficulty: 'beginner',
    templateOrientation: 'both',
    duration: 60,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.clock{height:100vh;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;position:relative}.clock::after{content:'';position:absolute;top:50%;left:50%;width:50vw;height:50vw;background:radial-gradient(circle,rgba(255,255,255,.03) 0%,transparent 70%);transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}.clock .content{position:relative;z-index:1}.clock .time{font-size:16vw;font-weight:200;font-family:'Courier New','SF Mono',monospace;letter-spacing:1.5vw;line-height:1;text-shadow:0 0 40px rgba(255,255,255,.08)}.clock .date{font-size:2.8vw;font-weight:300;opacity:.4;margin-top:3vh;letter-spacing:.15em;text-transform:uppercase}</style><div class="clock"><div class="content"><div class="time">{{time}}</div><div class="date">{{date}}</div></div></div>`,
    sampleData: { time: '10:30 AM', date: 'Saturday, February 8, 2026' },
  },

  // 3. Motivational Quote
  {
    name: 'Motivational Quote',
    description: 'Sophisticated dark quote display with large decorative quotation marks as CSS pseudo-elements',
    category: 'general',
    libraryTags: ['quote', 'motivational', 'inspiration'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 15,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.quote{height:100vh;background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:8vw;position:relative;overflow:hidden}.quote::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.1) 0%,transparent 60%);pointer-events:none}.quote .wrapper{position:relative;z-index:1;max-width:75vw}.quote .text{font-family:'Playfair Display',serif;font-size:3.8vw;font-style:italic;line-height:1.5;margin-bottom:4vh;position:relative;padding:0 4vw}.quote .text::before{content:'\\201C';position:absolute;top:-4vh;left:-1vw;font-family:'Playfair Display',serif;font-size:14vw;color:rgba(167,139,250,.25);line-height:1;font-style:normal}.quote .text::after{content:'\\201D';position:absolute;bottom:-8vh;right:-1vw;font-family:'Playfair Display',serif;font-size:14vw;color:rgba(167,139,250,.25);line-height:1;font-style:normal}.quote .author{font-family:'Inter',sans-serif;font-size:2.2vw;font-weight:400;opacity:.6;font-style:normal;letter-spacing:.1em;text-transform:uppercase}</style><div class="quote"><div class="wrapper"><div class="text">{{quote}}</div><div class="author">&mdash; {{author}}</div></div></div>`,
    sampleData: { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  },

  // 4. Social Media Follow
  {
    name: 'Social Media Follow',
    description: 'Instagram-style gradient with platform handles and bold CTA',
    category: 'general',
    libraryTags: ['social', 'follow', 'handles'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.social{height:100vh;background:linear-gradient(135deg,#f9426c 0%,#c62dac 35%,#833ab4 60%,#5b51d8 85%,#fd8d32 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}.social::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 30% 70%,rgba(255,255,255,.1) 0%,transparent 50%);pointer-events:none}.social .content{position:relative;z-index:1}.social h1{font-family:'Inter',sans-serif;font-size:5vw;font-weight:900;text-transform:uppercase;letter-spacing:.15em;margin-bottom:5vh;text-shadow:0 4px 20px rgba(0,0,0,.25)}.social .handles{display:flex;flex-direction:column;gap:2.5vh;margin-bottom:5vh}.social .handle-row{font-size:2.8vw;font-weight:500;display:flex;align-items:center;justify-content:center;gap:1.5vw;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);padding:1.5vh 3vw;border-radius:60px;box-shadow:0 4px 15px rgba(0,0,0,.15)}.social .icon{font-size:2.5vw;width:3vw;text-align:center}.social .cta{font-size:2.5vw;font-weight:700;text-transform:uppercase;letter-spacing:.2em;opacity:.9}</style><div class="social"><div class="content"><h1>Follow Us</h1><div class="handles"><div class="handle-row"><span class="icon">&#9679;</span> {{handle1}}</div><div class="handle-row"><span class="icon">&#9679;</span> {{handle2}}</div><div class="handle-row"><span class="icon">&#9679;</span> {{handle3}}</div></div><div class="cta">Stay Connected</div></div></div>`,
    sampleData: { handle1: '@company on Instagram', handle2: '@company on Twitter', handle3: '/company on Facebook' },
  },

  // 5. Contact Information
  {
    name: 'Contact Information',
    description: 'Clean white professional contact card with subtle CSS-based icons',
    category: 'general',
    libraryTags: ['contact', 'info', 'business'],
    difficulty: 'beginner',
    templateOrientation: 'portrait',
    duration: 30,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.contact{height:100vh;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);display:flex;align-items:center;justify-content:center;padding:5vw;position:relative}.contact::before{content:'';position:absolute;top:0;left:0;width:100%;height:.6vh;background:linear-gradient(90deg,#4338ca,#6d28d9,#a855f7)}.contact .card{background:#fff;border-radius:2vw;padding:6vh 5vw;box-shadow:0 25px 60px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.04);text-align:center;max-width:85vw;width:100%}.contact h1{font-family:'Playfair Display',serif;font-size:5vw;color:#1e293b;margin-bottom:1vh;font-weight:900}.contact .divider{width:8vw;height:.4vh;background:linear-gradient(90deg,#4338ca,#a855f7);margin:3vh auto;border-radius:2px}.contact .info-list{display:flex;flex-direction:column;gap:2.5vh;margin-top:3vh}.contact .info-item{display:flex;align-items:center;justify-content:center;gap:1.5vw;font-size:2.5vw;color:#475569;font-weight:400}.contact .info-icon{width:4vw;height:4vw;background:linear-gradient(135deg,#4338ca,#a855f7);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.8vw;font-weight:700;flex-shrink:0}</style><div class="contact"><div class="card"><h1>{{businessName}}</h1><div class="divider"></div><div class="info-list"><div class="info-item"><span class="info-icon">&#9742;</span> {{phone}}</div><div class="info-item"><span class="info-icon">@</span> {{email}}</div><div class="info-item"><span class="info-icon">&#9873;</span> {{address}}</div></div></div></div>`,
    sampleData: { businessName: 'Your Business', phone: '(555) 123-4567', email: 'hello@business.com', address: '123 Main Street, Suite 100' },
  },

  // 6. Announcement Ticker
  {
    name: 'Announcement Ticker',
    description: 'Scrolling text announcement on dark background with gradient text and CSS animation',
    category: 'general',
    libraryTags: ['ticker', 'scrolling', 'announcement'],
    difficulty: 'intermediate',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.ticker{height:100vh;background:#0a0a1a;display:flex;align-items:center;overflow:hidden;position:relative}.ticker::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(99,102,241,.08) 0%,transparent 60%);pointer-events:none}.ticker .track{display:flex;align-items:center;height:100%;width:100%}.ticker .text{white-space:nowrap;font-size:6vw;font-weight:700;letter-spacing:.05em;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#818cf8);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:scroll 18s linear infinite,gradient 6s ease infinite}@keyframes scroll{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}@keyframes gradient{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}.ticker .line-top,.ticker .line-bottom{position:absolute;left:0;width:100%;height:2px}.ticker .line-top{top:25vh;background:linear-gradient(90deg,transparent,rgba(129,140,248,.3),transparent)}.ticker .line-bottom{bottom:25vh;background:linear-gradient(90deg,transparent,rgba(192,132,252,.3),transparent)}</style><div class="ticker"><div class="line-top"></div><div class="track"><div class="text">{{message}}</div></div><div class="line-bottom"></div></div>`,
    sampleData: { message: 'Important: Building maintenance scheduled for this Saturday 8 AM - 12 PM. Please plan accordingly.' },
  },

  // 7. Before & After
  {
    name: 'Before & After',
    description: 'Split-screen comparison with red left and green right panels',
    category: 'general',
    libraryTags: ['comparison', 'before-after', 'showcase'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.ba{height:100vh;display:grid;grid-template-columns:1fr 1fr;position:relative}.ba .side{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:5vw;position:relative;overflow:hidden}.ba .before{background:linear-gradient(160deg,#dc2626 0%,#991b1b 100%)}.ba .after{background:linear-gradient(160deg,#16a34a 0%,#15803d 100%)}.ba .side::before{content:'';position:absolute;top:-10vh;right:-5vw;width:30vw;height:30vw;background:radial-gradient(circle,rgba(255,255,255,.08) 0%,transparent 70%);border-radius:50%;pointer-events:none}.ba .label{font-size:2.5vw;font-weight:700;text-transform:uppercase;letter-spacing:.3em;color:rgba(255,255,255,.6);margin-bottom:3vh}.ba h2{font-family:'Playfair Display',serif;font-size:5vw;font-weight:900;color:#fff;margin-bottom:3vh;text-shadow:0 4px 15px rgba(0,0,0,.2)}.ba p{font-size:2.5vw;color:rgba(255,255,255,.85);line-height:1.6;font-weight:300;max-width:35vw}.ba .divider{position:absolute;top:10vh;bottom:10vh;left:50%;width:4px;background:rgba(255,255,255,.2);transform:translateX(-50%);z-index:2;border-radius:2px}.ba .vs{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3;width:6vw;height:6vw;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2vw;font-weight:800;color:#333;box-shadow:0 8px 25px rgba(0,0,0,.2)}</style><div class="ba"><div class="side before"><span class="label">Before</span><h2>Before</h2><p>{{beforeText}}</p></div><div class="side after"><span class="label">After</span><h2>After</h2><p>{{afterText}}</p></div><div class="divider"></div><div class="vs">VS</div></div>`,
    sampleData: { beforeText: 'Manual processes, paper forms, slow turnaround', afterText: 'Digital workflows, instant updates, 3x faster' },
  },

  // 8. Number Counter
  {
    name: 'Number Counter',
    description: 'Bold blue impact number with massive display and subtle text shadow',
    category: 'general',
    libraryTags: ['number', 'stats', 'impact'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 15,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.counter{height:100vh;background:linear-gradient(160deg,#1e40af 0%,#1d4ed8 40%,#2563eb 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}.counter::before{content:'';position:absolute;top:50%;left:50%;width:80vw;height:80vw;background:radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 60%);transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}.counter::after{content:'';position:absolute;bottom:-20vh;left:10vw;width:50vw;height:50vw;background:radial-gradient(circle,rgba(96,165,250,.2) 0%,transparent 60%);border-radius:50%;pointer-events:none}.counter .content{position:relative;z-index:1}.counter .num{font-family:'Inter',sans-serif;font-size:18vw;font-weight:900;line-height:1;text-shadow:0 8px 40px rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.15)}.counter .label{font-size:3.5vw;font-weight:300;opacity:.8;margin-top:2vh;letter-spacing:.1em;text-transform:uppercase}</style><div class="counter"><div class="content"><div class="num">{{number}}</div><div class="label">{{label}}</div></div></div>`,
    sampleData: { number: '10,000+', label: 'Customers Served' },
  },

  // 9. Feedback Request
  {
    name: 'Feedback Request',
    description: 'Warm amber/gold gradient with prominent CTA and URL badge',
    category: 'general',
    libraryTags: ['feedback', 'survey', 'review'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.feedback{height:100vh;background:linear-gradient(135deg,#f59e0b 0%,#d97706 40%,#b45309 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:5vw;position:relative;overflow:hidden}.feedback::before{content:'';position:absolute;top:-15vh;right:-10vw;width:50vw;height:50vw;background:radial-gradient(circle,rgba(255,255,255,.12) 0%,transparent 60%);border-radius:50%;pointer-events:none}.feedback .content{position:relative;z-index:1;max-width:75vw}.feedback h1{font-family:'Playfair Display',serif;font-size:5.5vw;font-weight:900;margin-bottom:2.5vh;text-shadow:0 4px 20px rgba(0,0,0,.15)}.feedback p{font-size:2.5vw;font-weight:300;margin-bottom:4vh;opacity:.9;line-height:1.5}.feedback .url-badge{display:inline-block;background:rgba(255,255,255,.2);backdrop-filter:blur(10px);padding:2vh 4vw;border-radius:1.5vw;font-size:3vw;font-weight:700;letter-spacing:.05em;box-shadow:0 8px 30px rgba(0,0,0,.15),inset 0 1px 0 rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.15)}</style><div class="feedback"><div class="content"><h1>{{title}}</h1><p>{{message}}</p><div class="url-badge">{{url}}</div></div></div>`,
    sampleData: { title: 'We Value Your Feedback', message: 'Tell us about your experience today', url: 'feedback.company.com' },
  },

  // 10. Photo Gallery
  {
    name: 'Photo Gallery',
    description: 'Dark 3x2 grid with numbered placeholder cards and subtle borders',
    category: 'general',
    libraryTags: ['photos', 'gallery', 'grid'],
    difficulty: 'intermediate',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.gallery{height:100vh;background:#0f0f17;padding:2vw;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:1.2vw}.gallery .photo{background:linear-gradient(145deg,#1a1a2e,#16213e);border:1px solid rgba(99,102,241,.15);border-radius:1.2vw;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,.5);font-size:2.2vw;font-weight:500;position:relative;overflow:hidden;transition:all .3s ease}.gallery .photo::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle at 50% 40%,rgba(99,102,241,.06) 0%,transparent 60%);pointer-events:none}.gallery .photo .number{font-size:5vw;font-weight:800;color:rgba(99,102,241,.15);position:absolute;top:1vh;right:1.5vw;font-family:'Inter',sans-serif}.gallery .photo .caption{position:relative;z-index:1;font-weight:400;letter-spacing:.05em}</style><div class="gallery"><div class="photo"><span class="number">01</span><span class="caption">{{caption1}}</span></div><div class="photo"><span class="number">02</span><span class="caption">{{caption2}}</span></div><div class="photo"><span class="number">03</span><span class="caption">{{caption3}}</span></div><div class="photo"><span class="number">04</span><span class="caption">{{caption4}}</span></div><div class="photo"><span class="number">05</span><span class="caption">{{caption5}}</span></div><div class="photo"><span class="number">06</span><span class="caption">{{caption6}}</span></div></div>`,
    sampleData: { caption1: 'Photo 1', caption2: 'Photo 2', caption3: 'Photo 3', caption4: 'Photo 4', caption5: 'Photo 5', caption6: 'Photo 6' },
  },

  // 11. Tip of the Day
  {
    name: 'Tip of the Day',
    description: 'Teal/cyan gradient with lightbulb-style CSS decoration and clean tip layout',
    category: 'general',
    libraryTags: ['tip', 'fact', 'daily'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 20,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.tip{height:100vh;background:linear-gradient(135deg,#0d9488 0%,#0891b2 50%,#0e7490 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:8vw;position:relative;overflow:hidden}.tip::before{content:'';position:absolute;top:8vh;right:10vw;width:12vw;height:12vw;border:3px solid rgba(255,255,255,.1);border-radius:50%;pointer-events:none}.tip::after{content:'';position:absolute;top:11vh;right:13vw;width:6vw;height:6vw;background:radial-gradient(circle,rgba(250,204,21,.25) 0%,rgba(250,204,21,.08) 40%,transparent 70%);border-radius:50%;pointer-events:none}.tip .content{position:relative;z-index:1;max-width:70vw}.tip .bulb{width:8vw;height:8vw;margin:0 auto 3vh;background:rgba(250,204,21,.15);border:2px solid rgba(250,204,21,.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:4vw;box-shadow:0 0 40px rgba(250,204,21,.15)}.tip h2{font-size:2.8vw;font-weight:500;opacity:.8;margin-bottom:2vh;letter-spacing:.15em;text-transform:uppercase}.tip h1{font-family:'Playfair Display',serif;font-size:4.5vw;font-weight:900;margin-bottom:3vh;text-shadow:0 4px 15px rgba(0,0,0,.15)}.tip p{font-size:2.5vw;line-height:1.7;opacity:.9;font-weight:300}</style><div class="tip"><div class="content"><div class="bulb">&#128161;</div><h2>{{label}}</h2><h1>{{title}}</h1><p>{{content}}</p></div></div>`,
    sampleData: { label: 'Tip of the Day', title: 'Keyboard Shortcuts', content: 'Press Ctrl+Shift+T to reopen the last closed browser tab. Works in Chrome, Firefox, and Edge!' },
  },

  // 12. Thank You Screen
  {
    name: 'Thank You Screen',
    description: 'Elegant purple gradient with large Playfair Display heading and warm closing feel',
    category: 'general',
    libraryTags: ['thank-you', 'closing', 'gratitude'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 15,
    templateHtml: `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;overflow:hidden}.thanks{height:100vh;background:linear-gradient(135deg,#581c87 0%,#7c3aed 40%,#8b5cf6 70%,#a78bfa 100%);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}.thanks::before{content:'';position:absolute;top:15vh;left:50%;width:50vw;height:50vw;background:radial-gradient(circle,rgba(255,255,255,.08) 0%,transparent 60%);transform:translateX(-50%);border-radius:50%;pointer-events:none}.thanks::after{content:'';position:absolute;bottom:-15vh;right:-10vw;width:45vw;height:45vw;background:radial-gradient(circle,rgba(196,181,253,.15) 0%,transparent 60%);border-radius:50%;pointer-events:none}.thanks .content{position:relative;z-index:1}.thanks h1{font-family:'Playfair Display',serif;font-size:8vw;font-weight:900;line-height:1.1;margin-bottom:3vh;text-shadow:0 6px 25px rgba(0,0,0,.2)}.thanks .divider{width:10vw;height:.4vh;background:rgba(255,255,255,.4);margin:0 auto 3vh;border-radius:2px}.thanks p{font-size:2.8vw;font-weight:300;opacity:.85;letter-spacing:.05em;max-width:60vw;margin:0 auto;line-height:1.5}</style><div class="thanks"><div class="content"><h1>{{message}}</h1><div class="divider"></div><p>{{subtitle}}</p></div></div>`,
    sampleData: { message: 'Thank You!', subtitle: 'We appreciate your visit. See you next time!' },
  },
];
