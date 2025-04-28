# Publishing the package to npmjs.com

- Update the version number in package.json
- Update CHANGELOG.md
- npm install
- commit
- tag with v1.2.3 and push. A Github Actions worklfow will build the package and publish it on tag pushes.
