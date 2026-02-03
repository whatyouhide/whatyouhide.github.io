// Travels map with Rough.js sketch-style rendering
(function () {
  "use strict";

  // DOM elements
  const mapContainer = document.getElementById("travels-map");
  const modal = document.getElementById("country-modal");
  const modalCountryName = document.getElementById("modal-country-name");
  const modalTrips = document.getElementById("modal-trips");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const zoomResetBtn = document.getElementById("zoom-reset");

  // Parse travel data from the script tag
  const travelsData = JSON.parse(document.getElementById("travels-data").textContent);
  const countries = travelsData.countries;
  const settings = travelsData.settings;

  // Get CSS colors from the document
  function getColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      land: styles.getPropertyValue("--color-site-background-accented").trim(),
      landStroke: styles.getPropertyValue("--color-box-borders").trim(),
      visited: styles.getPropertyValue("--color-links").trim(),
      visitedStroke: styles.getPropertyValue("--color-links-hover").trim(),
      home: "#4a9d4a",
      homeStroke: "#3d823d",
      water: styles.getPropertyValue("--color-site-background").trim(),
    };
  }

  let colors = getColors();

  // Set up SVG dimensions
  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;

  // Create SVG
  const svg = d3
    .select("#travels-map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Create a group for zoomable content
  const g = svg.append("g");

  // Create Rough.js instance
  const rc = rough.svg(svg.node());

  // Set up projection - Natural Earth projection centered on Europe
  const projection = d3
    .geoNaturalEarth1()
    .scale((width / 5.5) * settings.defaultZoom)
    .center([settings.centerLon, settings.centerLat])
    .translate([width / 2, height / 2]);

  // Create path generator
  const path = d3.geoPath().projection(projection);

  // Set up zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 8])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Zoom controls
  zoomInBtn.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
  });

  zoomOutBtn.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.67);
  });

  zoomResetBtn.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  });

  // Tooltip
  let tooltip = null;

  function showTooltip(event, countryData, isHome) {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "country-tooltip";
      document.body.appendChild(tooltip);
    }

    tooltip.textContent = countryData.name;
    tooltip.className = "country-tooltip" + (isHome ? " home" : "");

    const x = event.pageX + 10;
    const y = event.pageY - 30;

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    tooltip.style.display = "block";
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }

  function moveTooltip(event) {
    if (tooltip && tooltip.style.display !== "none") {
      tooltip.style.left = event.pageX + 10 + "px";
      tooltip.style.top = event.pageY - 30 + "px";
    }
  }

  // Modal functions
  function openModal(countryCode, countryData) {
    modalCountryName.innerHTML =
      countryData.name +
      (countryData.home
        ? '<span class="home-badge">Home</span>'
        : "");

    if (countryData.trips && countryData.trips.length > 0) {
      modalTrips.innerHTML = countryData.trips
        .map(
          (trip) => `
        <div class="trip-item">
          <div class="trip-dates">${trip.dates}</div>
          ${trip.cities ? `<div class="trip-cities">${trip.cities.join(", ")}</div>` : ""}
          ${trip.notes ? `<div class="trip-notes">${trip.notes}</div>` : ""}
        </div>
      `
        )
        .join("");
    } else if (countryData.home) {
      modalTrips.innerHTML =
        '<p class="no-trips">This is where I\'m from!</p>';
    } else {
      modalTrips.innerHTML =
        '<p class="no-trips">Just passing through, no specific trips recorded.</p>';
    }

    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // Modal event listeners
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  modal.querySelector(".modal-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });

  // Render the map
  let countryElements = [];

  function renderMap() {
    // Clear existing content
    g.selectAll("*").remove();
    countryElements = [];

    const countriesGeo = topojson.feature(
      worldData,
      worldData.objects.countries
    );

    // Draw each country
    countriesGeo.features.forEach((feature) => {
      const countryId = feature.id;
      // Pad country ID to 3 digits to match ISO format (e.g., 32 -> "032")
      const paddedId = String(countryId).padStart(3, "0");
      const alpha3 = numericToAlpha3[paddedId];
      const countryData = alpha3 ? countries[alpha3] : null;
      const isVisited = countryData && countryData.visited;
      const isHome = countryData && countryData.home;

      // Generate the path
      const pathData = path(feature);
      if (!pathData) return;

      // Determine colors
      let fillColor, strokeColor;
      if (isHome) {
        fillColor = colors.home;
        strokeColor = colors.homeStroke;
      } else if (isVisited) {
        fillColor = colors.visited;
        strokeColor = colors.visitedStroke;
      } else {
        fillColor = colors.land;
        strokeColor = colors.landStroke;
      }

      let node;

      if (isVisited) {
        // For visited countries: sketchy hachure fill + clean border
        // Create a group to hold both layers
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.node().appendChild(group);

        // Layer 1: Rough.js hachure fill (no stroke)
        const roughFill = rc.path(pathData, {
          fill: fillColor,
          stroke: "none",
          fillStyle: "hachure",
          fillWeight: 0.5,
          hachureGap: 4,
          hachureAngle: isHome ? 45 : 60,
          roughness: 0.4,
          bowing: 0.2,
        });
        group.appendChild(roughFill);

        // Layer 2: Clean SVG border on top
        const cleanBorder = document.createElementNS("http://www.w3.org/2000/svg", "path");
        cleanBorder.setAttribute("d", pathData);
        cleanBorder.setAttribute("fill", "none");
        cleanBorder.setAttribute("stroke", strokeColor);
        cleanBorder.setAttribute("stroke-width", "1");
        group.appendChild(cleanBorder);

        node = group;
      } else {
        // For non-visited countries: clean SVG path
        const cleanPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        cleanPath.setAttribute("d", pathData);
        cleanPath.setAttribute("fill", fillColor);
        cleanPath.setAttribute("stroke", strokeColor);
        cleanPath.setAttribute("stroke-width", "0.5");
        node = g.node().appendChild(cleanPath);
      }

      // Add interactivity for visited countries
      if (isVisited) {
        d3.select(node)
          .style("cursor", "pointer")
          .on("mouseenter", function (event) {
            showTooltip(event, countryData, isHome);
            // Bring to front
            this.parentNode.appendChild(this);
          })
          .on("mousemove", moveTooltip)
          .on("mouseleave", hideTooltip)
          .on("click", function () {
            hideTooltip();
            openModal(alpha3, countryData);
          });
      }

      countryElements.push({
        node,
        countryId,
        alpha3,
        isVisited,
        isHome,
      });
    });
  }

  // Load country code mapping and map data, then render
  let numericToAlpha3 = {};
  let worldData = null;

  Promise.all([
    d3.json("/assets/geo/country-codes.json"),
    d3.json("/assets/geo/countries-110m.json"),
  ]).then(([codes, world]) => {
    numericToAlpha3 = codes;
    worldData = world;
    renderMap();
  });

  // Re-render on dark mode change
  const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkModeMediaQuery.addEventListener("change", () => {
    colors = getColors();
    if (worldData) renderMap();
  });

  // Handle window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newWidth = mapContainer.clientWidth;
      const newHeight = mapContainer.clientHeight;

      svg.attr("width", newWidth).attr("height", newHeight);
      svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);

      projection
        .scale((newWidth / 5.5) * settings.defaultZoom)
        .translate([newWidth / 2, newHeight / 2]);

      if (worldData) renderMap();
    }, 250);
  });
})();
