cd dist-pages

git init
git add -A
git commit -m "deploy"

git push -f --progress "https://github.com/bolanxian/metadata-fetcher.git" master:gh-pages