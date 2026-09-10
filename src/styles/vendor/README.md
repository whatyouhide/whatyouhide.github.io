# Neat Annotations

Source: <https://github.com/syabro/neat-annotations>

Revision: `83199c8c7420b85f775c770c5ee481df69b840bc`.

The CSS is unchanged, with the MIT license added as a comment.
Keep this notice when you update the file. The site also serves the license at
`/licenses/neat-annotations.txt` and the Shantell Sans font license at
`/licenses/shantell-sans.txt`.

Use `src/components/neat-annotation.astro` in MDX. It accepts `note`, `direction`,
and `mark` props. Set `mark={false}` to omit the text highlight.
Leave space for arrows and labels, which sit outside the target.
Keep essential text in HTML, since `data-note` is a visual aid.
