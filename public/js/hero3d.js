// hero3d.js
// Animation 3D d'accueil avec Three.js.
//
// Concept : un amas de "blocs" low-poly façon Roblox Studio flottent dans
// l'espace, tournent lentement, reagissent legerement a la souris, entoures
// de particules. Une animation d'entree (zoom + fade) se joue au chargement.
//
// Le module expose juste une fonction d'init/destroy, appelee par le routeur
// uniquement quand la page d'accueil est affichee (pour ne pas faire tourner
// le rendu 3D en arriere-plan quand on visite d'autres pages).

const Hero3D = (() => {
  let renderer, scene, camera, animationId;
  let mouseX = 0, mouseY = 0, targetRotX = 0, targetRotY = 0;
  let blocksGroup, particles;
  let resizeHandler, mouseMoveHandler;
  let canvasEl;
  let introStartTime;

  const COLORS = [0x6c5ce7, 0x8d7bff, 0x29d3c8, 0xff5fa2];

  function init(canvas) {
    if (!window.THREE) return; // securite si le CDN n'a pas charge
    canvasEl = canvas;

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    // Lumieres : une ambiante douce + deux directionnelles colorees pour un
    // rendu un peu "neon" coherent avec la palette du site.
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const light1 = new THREE.DirectionalLight(0x8d7bff, 1.1);
    light1.position.set(5, 6, 8);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0x29d3c8, 0.8);
    light2.position.set(-6, -4, 4);
    scene.add(light2);

    // ---- Groupe de blocs low-poly (esprit "Roblox") ----
    blocksGroup = new THREE.Group();
    const blockCount = 9;
    for (let i = 0; i < blockCount; i++) {
      const size = 0.9 + Math.random() * 1.6;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const color = COLORS[i % COLORS.length];
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.25,
        roughness: 0.35,
        emissive: color,
        emissiveIntensity: 0.12,
      });
      const mesh = new THREE.Mesh(geometry, material);

      const radius = 4.2 + Math.random() * 3.5;
      const angle = (i / blockCount) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 6,
        Math.sin(angle) * radius - 2
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      // donnees d'animation propres a chaque bloc (flottement independant)
      mesh.userData.floatSpeed = 0.4 + Math.random() * 0.6;
      mesh.userData.floatOffset = Math.random() * Math.PI * 2;
      mesh.userData.rotSpeedX = (Math.random() - 0.5) * 0.25;
      mesh.userData.rotSpeedY = (Math.random() - 0.5) * 0.25;
      mesh.userData.baseY = mesh.position.y;

      blocksGroup.add(mesh);
    }
    scene.add(blocksGroup);

    // ---- Particules en arriere-plan ----
    const particleCount = 220;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x8d7bff,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // ---- Animation d'entree : camera qui "arrive" + fade-in du groupe ----
    camera.position.z = 26;
    blocksGroup.scale.set(0.4, 0.4, 0.4);
    introStartTime = performance.now();

    // ---- Interaction souris (parallaxe legere) ----
    mouseMoveHandler = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', mouseMoveHandler);

    resizeHandler = () => {
      if (!canvasEl) return;
      const w = canvasEl.clientWidth || window.innerWidth;
      const h = canvasEl.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', resizeHandler);

    animate();
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const elapsed = (performance.now() - introStartTime) / 1000;

    // Phase d'intro (1.6s) : la camera se rapproche, les blocs grossissent.
    if (elapsed < 1.6) {
      const t = easeOutCubic(Math.min(elapsed / 1.6, 1));
      camera.position.z = 26 - t * (26 - 14);
      const scale = 0.4 + t * 0.6;
      blocksGroup.scale.set(scale, scale, scale);
    }

    // Rotation lente d'ensemble + flottement individuel de chaque bloc.
    blocksGroup.rotation.y += 0.0016;

    blocksGroup.children.forEach((mesh) => {
      const t = performance.now() / 1000;
      mesh.position.y = mesh.userData.baseY + Math.sin(t * mesh.userData.floatSpeed + mesh.userData.floatOffset) * 0.4;
      mesh.rotation.x += mesh.userData.rotSpeedX * 0.01;
      mesh.rotation.y += mesh.userData.rotSpeedY * 0.01;
    });

    // Parallaxe douce vers la position de la souris.
    targetRotX += (mouseY * 0.15 - targetRotX) * 0.04;
    targetRotY += (mouseX * 0.2 - targetRotY) * 0.04;
    blocksGroup.rotation.x = targetRotX;
    camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.03;
    camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    particles.rotation.y += 0.0004;

    renderer.render(scene, camera);
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (renderer) {
      renderer.dispose();
    }
    scene = camera = renderer = blocksGroup = particles = null;
    canvasEl = null;
  }

  return { init, destroy };
})();
