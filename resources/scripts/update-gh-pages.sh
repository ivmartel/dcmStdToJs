#!/bin/bash
#Script to push current repo on the repository gh-pages branch.

# we should be in /home/travis/build/ivmartel/dcmStdToJs
echo -e "Starting to update gh-pages\n"

# go to home and setup git
cd $HOME
git config --global user.email "travis@travis-ci.org"
git config --global user.name "Travis"
# using token, clone gh-pages branch
git clone --quiet --branch=gh-pages https://${GH_TOKEN}@github.com/ivmartel/dcmStdToJs.git gh-pages
# change dir to demo
cd $HOME/gh-pages/demo/trunk
# clean up
rm -Rf *
# copy new build here
cp -Rf $HOME/build/ivmartel/dcmStdToJs/* .
# remove gitignore
rm -f .gitignore
# clean up build folder
rm -Rf build/*
# clean up node_modules
rm -Rf node_modules/*
# download production dependencies
yarn install --prod
# move back to root of repo
cd $HOME/gh-pages
# add, commit and push files
git add -Af .
git commit -m "Travis build $TRAVIS_BUILD_NUMBER pushed to gh-pages"
git push -fq origin gh-pages

echo -e "Done updating.\n"
