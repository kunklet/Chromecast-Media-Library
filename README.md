Chromecast-Media-Library
========================

Chromecast Media Library using AngularJS

## Setup Instructions

# Pre-requisites
 1. Get a Chromecast device
 2. Install appropriate Chrome browser
 3. Install appropriate Chrome Cast extension
 4. Add your Chromecast device in the Google Cast SDK Developer Console: https://cast.google.com/publish/
 
# Steps:
 1. Put all project files on your server. No server side processing necessary.
 2. Use the default media receiver app. No need to setup an application leave the APP ID as the default.
 4. Open a browser and go to your page at http://[YOUR_SERVER_LOCATION]/[FOLDER_PATH]/index.html
 5. If all is well you will see a cast icon in the top left of the page.
 6. To add additional movies edit the $scope.movies array or add to movieList.json and change $scope.useJsonMovieListFile = true