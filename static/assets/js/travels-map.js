// Travels map — terminal/CRT aesthetic, flat SVG rendering
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
  const mapStatus = document.getElementById("map-status");

  // Parse travel data from the script tag
  const travelsData = JSON.parse(document.getElementById("travels-data").textContent);
  const countries = travelsData.countries;
  const settings = travelsData.settings;

  // Parse places data
  const placesData = JSON.parse(document.getElementById("places-data").textContent);
  const countryPlacesEl = document.getElementById("country-places");

  // Get CSS colors from the document
  function getColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      land: styles.getPropertyValue("--color-site-background-accented").trim(),
      landStroke: styles.getPropertyValue("--color-box-borders").trim(),
      visited: styles.getPropertyValue("--color-links").trim(),
      visitedStroke: styles.getPropertyValue("--color-links-hover").trim(),
      home: styles.getPropertyValue("--color-links-hover").trim(),
      homeStroke: "#fff",
      water: styles.getPropertyValue("--color-site-background").trim(),
      textDimmer: styles.getPropertyValue("--color-text-dimmer").trim(),
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

  // Define a glow filter for the home country
  const defs = svg.append("defs");
  const glowFilter = defs.append("filter").attr("id", "glow");
  glowFilter
    .append("feGaussianBlur")
    .attr("stdDeviation", "3")
    .attr("result", "blur");
  const glowMerge = glowFilter.append("feMerge");
  glowMerge.append("feMergeNode").attr("in", "blur");
  glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Create a group for zoomable content
  const g = svg.append("g");

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

    tooltip.textContent = "> " + countryData.name;
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
        ? '<span class="home-badge">HOME</span>'
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
        '<p class="no-trips">origin_country=true</p>';
    } else {
      modalTrips.innerHTML =
        '<p class="no-trips">No trips recorded.</p>';
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

  // Show place posts for a country below the map
  function showCountryPlaces(countryCode, countryData) {
    const places = placesData.filter((p) => p.country === countryCode);

    if (places.length === 0) {
      countryPlacesEl.hidden = true;
      return;
    }

    const links = places
      .map((p) => `<a href="${p.path}">${p.title}</a>`)
      .join("");

    countryPlacesEl.innerHTML =
      `<span class="country-places-label">> ${countryData.name}:</span> ${links}`;
    countryPlacesEl.hidden = false;
    countryPlacesEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Count visited countries
  function countVisited() {
    return Object.values(countries).filter((c) => c.visited).length;
  }

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
      const paddedId = String(countryId).padStart(3, "0");
      const alpha3 = numericToAlpha3[paddedId];
      const countryData = alpha3 ? countries[alpha3] : null;
      const isVisited = countryData && countryData.visited;
      const isHome = countryData && countryData.home;

      const pathData = path(feature);
      if (!pathData) return;

      // Determine colors
      let fillColor, strokeColor, strokeWidth;
      if (isHome) {
        fillColor = colors.home;
        strokeColor = colors.homeStroke;
        strokeWidth = "1.2";
      } else if (isVisited) {
        fillColor = colors.visited;
        strokeColor = colors.visitedStroke;
        strokeWidth = "0.8";
      } else {
        fillColor = colors.land;
        strokeColor = colors.landStroke;
        strokeWidth = "0.3";
      }

      const node = g
        .append("path")
        .attr("d", pathData)
        .attr("fill", fillColor)
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth)
        .attr("fill-opacity", isVisited ? 0.7 : 0.4)
        .node();

      if (isHome) {
        d3.select(node).attr("filter", "url(#glow)").attr("fill-opacity", 0.85);
      }

      // Add interactivity for visited countries
      if (isVisited) {
        d3.select(node)
          .style("cursor", "pointer")
          .on("mouseenter", function (event) {
            showTooltip(event, countryData, isHome);
            d3.select(this)
              .transition()
              .duration(120)
              .attr("fill-opacity", 1)
              .attr("stroke-width", "1.5");
            this.parentNode.appendChild(this);
          })
          .on("mousemove", moveTooltip)
          .on("mouseleave", function () {
            hideTooltip();
            d3.select(this)
              .transition()
              .duration(200)
              .attr("fill-opacity", isHome ? 0.85 : 0.7)
              .attr("stroke-width", isHome ? "1.2" : "0.8");
          })
          .on("pointerdown", function (event) {
            this.__clickStart = { x: event.clientX, y: event.clientY };
          })
          .on("pointerup", function (event) {
            const start = this.__clickStart;
            if (!start) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            // Only treat as click if pointer barely moved (not a drag/pan)
            if (dx * dx + dy * dy < 25) {
              hideTooltip();
              showCountryPlaces(alpha3, countryData);
            }
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

    // Update status line
    mapStatus.textContent = countVisited() + " VISITED";
  }

  // Load country code mapping and map data, then render
  let numericToAlpha3 = {};
  let worldData = null;

  mapStatus.textContent = "LOADING...";

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
