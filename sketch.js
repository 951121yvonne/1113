// sketch.js

let flowField;        
let resolution = 20;  // 網格的解析度
let particles = [];   
let numParticles = 1000; // 粒子數量

let hueShift = 0;     // 用於顏色隨時間和滑鼠變化的色調偏移
let baseHue = 200;    // 基礎色調 

let injectedColors = [];
let maxInjectedColors = 5; 

let zoff = 0;
let zoffSpeed = 0.0003; 

function setup() {
    // 創建畫布，讓它全螢幕
    const canvas = createCanvas(windowWidth, windowHeight);
    // 將畫布設置為固定在背景 (CSS 會處理定位)
    canvas.style('z-index', '-1');
    canvas.style('position', 'fixed');

    colorMode(HSB, 360, 100, 100, 1); 

    // 初始化粒子
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }

    // 計算流量場網格的尺寸
    flowField = new Array(floor(width / resolution) * floor(height / resolution));

    background(0, 0, 10); 
}

function draw() {
    // 繪製半透明的背景，形成疊加和拖影效果 (模擬流體)
    fill(0, 0, 10, 0.05); 
    rect(0, 0, width, height);

    // 更新流量場 (Flow Field)
    let yoff = 0;
    for (let y = 0; y < height / resolution; y++) {
        let xoff = 0;
        for (let x = 0; x < width / resolution; x++) {
            let index = x + y * floor(width / resolution);
            
            // Perlin Noise 決定流體流動的方向
            let angle = noise(xoff, yoff, zoff) * TWO_PI * 4; 
            let v = p5.Vector.fromAngle(angle);
            v.setMag(1); 

            // 滑鼠擾動：當滑鼠靠近時，改變流量場的局部方向和強度
            let distToMouse = dist(x * resolution, y * resolution, mouseX, mouseY);
            if (distToMouse < 150) { 
                let mouseVector = createVector(mouseX - x * resolution, mouseY - y * resolution);
                mouseVector.normalize(); 

                let influence = map(distToMouse, 0, 150, 1, 0); 
                
                v.sub(p5.Vector.mult(mouseVector, influence * 0.8)); // 排斥/擾動效果
                v.normalize(); 
                v.setMag(1.5); 
            }

            flowField[index] = v;

            xoff += 0.1; 
        }
        yoff += 0.1; 
    }

    // 更新並繪製粒子
    for (let i = 0; i < particles.length; i++) {
        particles[i].follow(flowField); 
        particles[i].update();
        particles[i].edges(); 
        
        // 計算粒子顏色 (基礎色調 + 全局偏移 + 注入顏色影響)
        let particleHue = (baseHue + hueShift + i * 0.1) % 360; 
        for (let j = 0; j < injectedColors.length; j++) {
            let inj = injectedColors[j];
            let d = dist(particles[i].pos.x, particles[i].pos.y, inj.pos.x, inj.pos.y);
            if (d < inj.radius) {
                let influence = map(d, 0, inj.radius, 1, 0);
                particleHue = lerp(particleHue, inj.hue, influence * 0.7); 
            }
        }

        particles[i].display(particleHue);
    }

    // 更新 Perlin Noise 的時間偏移
    zoff += zoffSpeed;

    // 隨機改變色調 (僅在滑鼠移動時)
    if (pmouseX !== mouseX || pmouseY !== mouseY) {
        hueShift = (hueShift + random(-5, 5)) % 360; 
    }
}

// 監聽視窗大小變化，重新設置畫布和流量場
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    background(0, 0, 10); 
    flowField = new Array(floor(width / resolution) * floor(height / resolution));
}

// 滑鼠點擊時注入新顏色
function mouseClicked() {
    let newHue = random(0, 360); 
    injectedColors.push({
        pos: createVector(mouseX, mouseY),
        hue: newHue,
        radius: 100 
    });

    if (injectedColors.length > maxInjectedColors) {
        injectedColors.shift(); 
    }
}

// ==== Particle 類別定義 ====
class Particle {
    constructor() {
        this.pos = createVector(random(width), random(height)); 
        this.vel = createVector(0, 0); 
        this.acc = createVector(0, 0); 
        this.maxspeed = 2; 
        this.history = []; 
        this.maxHistory = 20; 
    }

    follow(vectors) {
        let x = floor(this.pos.x / resolution);
        let y = floor(this.pos.y / resolution);
        let index = x + y * floor(width / resolution);
        if (vectors[index]) { 
            this.applyForce(vectors[index]);
        }
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.pos.add(this.vel);
        this.acc.mult(0); 

        // 更新粒子歷史紀錄 (筆刷拖曳效果)
        this.history.push(this.pos.copy()); 
        if (this.history.length > this.maxHistory) {
            this.history.splice(0, 1); 
        }
    }

    display(currentHue) {
        // 筆刷效果：繪製粒子的歷史路徑
        noFill();
        strokeWeight(1); 

        for (let i = 0; i < this.history.length; i++) {
            let p = this.history[i];
            let alpha = map(i, 0, this.history.length - 1, 0, 0.5); 
            
            // 讓筆刷的顏色也能受到注入顏色的影響
            let brushHue = currentHue;
            for (let j = 0; j < injectedColors.length; j++) {
                let inj = injectedColors[j];
                let d = dist(p.x, p.y, inj.pos.x, inj.pos.y);
                if (d < inj.radius) {
                    let influence = map(d, 0, inj.radius, 1, 0);
                    brushHue = lerp(brushHue, inj.hue, influence * 0.5);
                }
            }
            
            stroke(brushHue, 80, 90, alpha); 
            point(p.x, p.y); 
        }
    }

    // 處理粒子出界：讓粒子從另一邊重新進入
    edges() {
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = height;
        if (this.pos.y > height) this.pos.y = 0;
    }
}