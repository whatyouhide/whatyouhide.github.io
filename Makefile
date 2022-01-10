.PHONY: help

check-all-links:
	@find * -name "*.md" -type f -exec echo /workdir/{} \; \
		| xargs -n1 -t docker run -v ${PWD}:/workdir:ro --rm -i ghcr.io/tcort/markdown-link-check:stable
