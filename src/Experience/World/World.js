import * as THREE from "three";
import { Environment, Floor, Stars } from "../brahma/Brahma.js";
import Experience from "../Experience.js";
import Topobath from "./Topobath.js";
import SealPath from "./SealPath.js";
import SeaLevelPlane from "./SeaLevelPlane.js";
import Sky from "./Sky.js";
import { Selectable } from "../brahma/Brahma.js";
import Papa from "papaparse";
import Legend from "./Legend.js";
import Graphs from "./Graphs.js";
import Callout from "./Callout.js";

export default class World {
  constructor() {
    this.experience = new Experience();
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.debug = this.experience.debug;
    this.debugFolder = this.debug.ui.addFolder("world");
    this.ready = false;
    // this.axesHelper = new THREE.AxesHelper(5);
    // this.scene.add(this.axesHelper);
    // this.floor = new Floor();
    // this.depthMarker = new DepthMarker();
    // Wait for resources

    this.resources.on("ready", () => {
      // this.stars = new Stars();
      this.topobath = new Topobath();
      this.topobath.ready.then(() => {
        console.log("topobath promise resolved");
        this.loadSealPaths();
      });
      this.environment = new Environment();
      this.seaLevelPlane = new SeaLevelPlane();
      this.skyBox = new Sky();
      this.legend = new Legend();
      this.graphs = new Graphs();
      this.callout = new Callout();
      this.callout.updateInformationDisplay(
        0,
        0,
        0,
        0,
        0,
        "",
        0,
        0,
        0,
        2,
        1,
        1
      );
    });
    this.ready = true;
  }
  loadSealPaths() {
    // Array of all seal data files to load
    const sealDataArray = [
      "FatiguedFiona-A",
      "FatiguedFiona-B",
      "FatiguedFiona-C",
      "FatiguedFiona-D",
      "FatiguedFiona-E",
      "FatiguedFiona-F",
      "FatiguedFiona-G",
      "FatiguedFiona-H",
      "FatiguedFiona-I",
      "HypoactiveHeidi-A",
      "HypoactiveHeidi-B",
      "HypoactiveHeidi-C",
      "HypoactiveHeidi-D",
      "HypoactiveHeidi-E",
      "HypoactiveHeidi-F",
      "HypoactiveHeidi-G",
      "HypoactiveHeidi-H",
      "HypoactiveHeidi-I",
      "HypoactiveHeidi-J",
      "JauntingJuliette-A",
      "JauntingJuliette-B",
      "JauntingJuliette-C",
      "JauntingJuliette-D",
      "JauntingJuliette-E",
      "JauntingJuliette-F",
      "JauntingJuliette-G",
    ];

    // Store seal paths organized by seal name
    this.fiona = [];
    this.heidi = [];
    this.juliette = [];

    this.sealPaths = []; // Keep an array of all seal paths too

    for (const filename of sealDataArray) {
      const data = this.csvToJson(`./${filename}.csv`);
      const sealPath = new SealPath(filename, data);

      // Add to appropriate seal array based on name
      if (filename.includes("Fiona")) {
        this.fiona.push(sealPath);
      } else if (filename.includes("Heidi")) {
        this.heidi.push(sealPath);
      } else if (filename.includes("Juliette")) {
        this.juliette.push(sealPath);
      }

      this.sealPaths.push(sealPath);
    }

    console.log(
      `Loaded seal paths: ${this.fiona.length} Fiona, ${this.heidi.length} Heidi, ${this.juliette.length} Juliette`
    );
    console.log(this.sealPaths);

    // Add debug controls for seal visibility
    this.sealVisibility = {
      fiona: true,
      heidi: true,
      juliette: true,
    };

    this.debugFolder
      .add(this.sealVisibility, "fiona")
      .name("Show Fiona")
      .onChange((value) => {
        this.fiona.forEach((sealPath) => {
          if (sealPath.path) sealPath.path.visible = value;
        });
      });

    this.debugFolder
      .add(this.sealVisibility, "heidi")
      .name("Show Heidi")
      .onChange((value) => {
        this.heidi.forEach((sealPath) => {
          if (sealPath.path) sealPath.path.visible = value;
        });
      });

    this.debugFolder
      .add(this.sealVisibility, "juliette")
      .name("Show Juliette")
      .onChange((value) => {
        this.juliette.forEach((sealPath) => {
          if (sealPath.path) sealPath.path.visible = value;
        });
      });

    // make it appropriate size please
    this.intersectionSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.intersectionSphere.visible = false;
    this.scene.add(this.intersectionSphere);
  }

  async csvToJson(filename) {
    const response = await fetch(filename);
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    return parsed.data;
  }

  update() {
    if (this.ready) {
      // this.depthReference?.update();
    }
  }
}
