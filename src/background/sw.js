'use strict';
// Chrome-MV3-Einstieg: lädt alle Module in den Service Worker.
// (Firefox nutzt stattdessen die scripts-Liste im Manifest.)
importScripts(
  '../common/compat.js',
  '../common/domain.js',
  '../common/categories.js',
  '../common/trackerdb.js',
  '../common/dbupdate.js',
  '../common/decoder.js',
  '../common/insights.js',
  '../common/score.js',
  'store.js',
  'capture.js',
  'main.js'
);
