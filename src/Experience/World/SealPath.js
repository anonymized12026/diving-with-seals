import * as THREE from "three";
import Experience from "../Experience";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "./LineMaterial.js";
import { Path } from "../brahma/Brahma.js";

export default class SealPath {
  constructor(name, sealData) {
    this.experience = new Experience();
    this.name = name; // Store filename for networking
    sealData.then((data) => {
      const sleepStateColors = this.experience.sleepStateColors;

      // Scale Y dynamically based on max depth
      const maxDepth = Math.max(...data.map((d) => d.Depth || 0), 1);
      this.yScale = 0.1 / maxDepth; // Normalized depth scale for scene
      this.yBump = 0; // Adjust vertically if terrain sits higher/lower

      // First pass: count valid entries
      const maxAllowedDepth = 2000;
      let validCount = 0;
      data.forEach((entry) => {
        if (
          !isFinite(entry.Depth) ||
          entry.Depth < 0 ||
          entry.Depth > maxAllowedDepth ||
          !isFinite(entry.Lat) ||
          !isFinite(entry.Long)
        ) {
          return;
        }
        validCount++;
      });

      if (validCount === 0) {
        console.warn(`No valid points for ${name}.`);
        return;
      }
      // Pre-allocate arrays with exact size
      const points = new Array(validCount);
      const orientation = new Array(validCount);
      const respiratory = new Float32Array(validCount);
      const strokeRates = new Float32Array(validCount);
      const heartRates = new Float32Array(validCount);
      const secondsArray = new Uint32Array(validCount);
      const rTimeArray = new Array(validCount);
      const sleepStates = new Uint8Array(validCount);
      const latitudes = new Float32Array(validCount);
      const longitudes = new Float32Array(validCount);
      const depths = new Float32Array(validCount);

      // Second pass: populate arrays
      let idx = 0;
      data.forEach((entry) => {
        // discard invalid data points
        if (
          !isFinite(entry.Depth) ||
          entry.Depth < 0 ||
          entry.Depth > maxAllowedDepth ||
          !isFinite(entry.Lat) ||
          !isFinite(entry.Long)
        ) {
          return;
        }

        let resp = entry.Resp_Num;
        let seconds = entry.Seconds;
        let rTime = entry.R_Time;
        let sleep = entry.Sleep_Num;
        let stroke = entry.Stroke_Rate;
        let heartRate = entry.Heart_Rate;

        let heading = entry.heading;
        let pitch = entry.pitch;
        let roll = entry.roll;

        let [x, y, z] = this.experience.world.topobath.projection(
          entry.Lat,
          entry.Long,
          entry.Depth
        );
        // Final transformed position
        const p = new THREE.Vector3(x, y, z);

        points[idx] = p;
        orientation[idx] = new THREE.Vector3(
          heading || 0,
          pitch || 0,
          roll || 0
        );
        respiratory[idx] = resp || 0;
        secondsArray[idx] = seconds || 0;
        rTimeArray[idx] = rTime || "";
        sleepStates[idx] = sleep || 0;
        strokeRates[idx] = stroke || 0;
        heartRates[idx] = heartRate || 0;
        latitudes[idx] = entry.Lat;
        longitudes[idx] = entry.Long;
        depths[idx] = entry.Depth;
        idx++;
      });

      // keep world-space points for ray checks
      this.points = points;
      this.orientation = orientation;
      this.respiratory = respiratory;
      this.secondsArray = secondsArray;
      this.rTimeArray = rTimeArray;
      this.sleepStates = sleepStates;
      this.strokeRates = strokeRates;
      this.heartRates = heartRates;
      this.latitudes = latitudes;
      this.longitudes = longitudes;
      this.depths = depths;

      // Build LineGeometry for fat-line rendering
      const positions = [];
      const colors = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        positions.push(p.x, p.y, p.z);

        // Map sleep state to color (1-5 range)
        const sleepState = Math.min(5, Math.max(0, sleepStates[i]));
        const color = sleepStateColors[sleepState];
        colors.push(color.r, color.g, color.b);
      }
      const geometry = new LineGeometry();
      geometry.setPositions(positions);
      geometry.setColors(colors);

      // Base color coding (fallback if colors not used)
      this.color = new THREE.Color(0x0000ff);
      if (name.includes("Fiona")) {
        this.color = new THREE.Color("LightGreen");
      } else if (name.includes("Heidi")) {
        this.color = new THREE.Color("Blue");
      } else if (name.includes("Juliette")) {
        this.color = new THREE.Color("GoldenRod");
      }
      const material = new LineMaterial({
        linewidth: 4, // Line thickness in pixels
        dashed: false,
        vertexColors: true, // Enable vertex colors for sleep state visualization
      });

      // Store material reference for resolution updates
      this.material = material;

      // Set initial resolution
      this.updateResolution();

      // Add resize listener for window size changes
      this.resizeHandler = () => this.updateResolution();
      window.addEventListener("resize", this.resizeHandler);

      // Handle VR session changes if WebXR is available
      if (this.experience.renderer?.xr) {
        this.xrSessionStartHandler = () => this.updateResolution();
        this.xrSessionEndHandler = () => this.updateResolution();
        this.experience.renderer.xr.addEventListener(
          "sessionstart",
          this.xrSessionStartHandler
        );
        this.experience.renderer.xr.addEventListener(
          "sessionend",
          this.xrSessionEndHandler
        );
      }

      this.path = new Path(geometry, material, name);
      this.path.sealPath = this; // Store reference to parent SealPath
      this.experience.world.scene.add(this.path);
    });
  }

  updateResolution() {
    if (!this.material) return;

    const renderer = this.experience.renderer;
    const canvas = renderer?.domElement;

    if (canvas) {
      // Get actual canvas size (works for VR and regular rendering)
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      this.material.resolution.set(width, height);
    } else {
      // Fallback to window size
      this.material.resolution.set(window.innerWidth, window.innerHeight);
    }
  }

  findNearestPoint(position) {
    if (!this.points || this.points.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let nearestIndex = 0;

    // Optimized search with early exit and distanceToSquared (faster than distanceTo)
    for (let i = 0; i < this.points.length; i++) {
      const distSq = position.distanceToSquared(this.points[i]);
      if (distSq < minDistance) {
        minDistance = distSq;
        nearestIndex = i;

        // Early exit if we're very close (within 1cm squared)
        if (distSq < 0.0001) break;
      }
    }

    // Return metadata for nearest point
    return {
      index: nearestIndex,
      position: this.points[nearestIndex],
      lat: this.latitudes[nearestIndex],
      lng: this.longitudes[nearestIndex],
      depth: this.depths[nearestIndex],
      resp: this.respiratory[nearestIndex],
      seconds: this.secondsArray[nearestIndex],
      rTime: this.rTimeArray[nearestIndex],
      sleep: this.sleepStates[nearestIndex],
      stroke: this.strokeRates[nearestIndex],
      heartRate: this.heartRates[nearestIndex],
      heading: this.orientation[nearestIndex].x,
      pitch: this.orientation[nearestIndex].y,
      roll: this.orientation[nearestIndex].z,
    };
  }

  dispose() {
    // Clean up event listeners
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }

    if (this.experience.renderer?.xr) {
      if (this.xrSessionStartHandler) {
        this.experience.renderer.xr.removeEventListener(
          "sessionstart",
          this.xrSessionStartHandler
        );
      }
      if (this.xrSessionEndHandler) {
        this.experience.renderer.xr.removeEventListener(
          "sessionend",
          this.xrSessionEndHandler
        );
      }
    }

    // Clean up geometry and material
    if (this.path) {
      if (this.path.geometry) this.path.geometry.dispose();
      if (this.material) this.material.dispose();
      if (this.path.parent) this.path.parent.remove(this.path);
    }
  }
}
