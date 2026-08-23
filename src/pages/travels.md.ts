import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import yaml from "js-yaml";
import { siteConfig } from "../config";
import travelsYaml from "../data/travels.yaml?raw";
import { markdownPageResponse } from "../lib/markdown-page";

type Country = {
  name: string;
  visited?: boolean;
  home?: boolean;
};

type Travels = {
  countries: Record<string, Country>;
};

export async function GET(_: APIContext) {
  const travels = yaml.load(travelsYaml) as Travels;
  const countries = Object.values(travels.countries)
    .filter((country) => country.visited)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => `- ${country.name}${country.home ? " (home)" : ""}`)
    .join("\n");
  const places = (await getCollection("places"))
    .sort((a, b) => a.data.title.localeCompare(b.data.title))
    .map((place) => {
      const slug = place.id.replace(/\/index$/, "");
      const country = place.data.countryName ? `, ${place.data.countryName}` : "";
      return `- [${place.data.title}](${siteConfig.baseUrl}/places/${slug}/)${country}`;
    })
    .join("\n");
  const placeNotes = places || "No place notes are available yet.";
  const source = `# Travels

Places I've been lucky enough to visit.

## Visited countries

${countries}

## Place notes

${placeNotes}

## More details

See the full travel map on [Skratch](https://share.skratch.world/045saE8YdC/visited).`;

  return markdownPageResponse({
    source,
    title: "Travels",
    description: "Places I've been lucky enough to visit.",
    canonical: `${siteConfig.baseUrl}/travels/`,
  });
}
