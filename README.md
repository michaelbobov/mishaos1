# MishaOS

A Windows 3.1-inspired operating system interface with retro games and interactive elements.

## About Me

This is my playground—a digital time capsule that blends past computer systems with my creative vision. My goal for this portfolio is to show who I am and create a nostalgic journey through retro computing, while showcasing my passion for making things.

I'm Russian American with a deep love for Japan, as you can see reflected in the music selection and the aesthetic of this project. I'm really passionate about creating stuff—I love making with Cursor and I'm not just a designer, I'm a maker. This project demonstrates that passion, combining design sensibilities with hands-on development to bring this retro computing experience to life.

I hope you enjoy exploring this time capsule as much as I enjoyed creating it.

## Setup

1. **Add your monitor image**: Place your CRT monitor room background image as `assets/monitor.png` (update the filename in `styles.css` line 17 if you choose a different name)

2. **Position the content**: The content area needs to be positioned precisely over the monitor screen in your image. You have two options:

   **Option A - Quick Adjustment:**
   - Open `index.html` in a browser
   - Press the **'P' key** to toggle a red outline showing the content area
   - Adjust the CSS variables in `styles.css` (in the `:root` section at the top) to move the content:
     - `--screen-width` and `--screen-height`: Size of the content area
     - `--screen-top`: Vertical position (percentage from top)
     - `--screen-left`: Horizontal position (percentage from left, will be centered)
     - `--screen-max-width` and `--screen-max-height`: Maximum dimensions

   **Option B - Visual Helper Tool:**
   - Open `position-helper.html` in a browser alongside `index.html`
   - Use the sliders to adjust the position visually
   - Copy the generated CSS and paste it into `styles.css`

3. Open `index.html` in a web browser

## Customization

- **Background Image**: Replace `monitor-image.jpg` with your own image (update `styles.css` line 17)
- **Monitor Screen Position**: Adjust the CSS variables in the `:root` section of `styles.css`
- **Content**: Edit `index.html` to add your own projects, text, and links
- **Colors**: Modify the green (#00ff00) color scheme in `styles.css` to match your aesthetic

## Features

- Retro CRT monitor screen effects (scanlines, flicker)
- Smooth scrolling navigation
- Responsive design
- Retro Japanese typography
- Glowing text effects
- Position helper (press 'P' key to see content area outline)

## Browser Support

Works best in modern browsers that support CSS3 features and CSS custom properties (variables).

