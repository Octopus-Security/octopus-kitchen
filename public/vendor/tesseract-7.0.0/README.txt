Self-hosted OCR, used only by public/nutrition-scan.js after the user taps Scan.
Copied unmodified from npm; each tarball's sha512 was checked against the registry.

  tesseract.min.js, worker.min.js      tesseract.js@7.0.0 dist/            Apache-2.0
  tesseract-core-*.wasm.js             tesseract.js-core@7.0.0             Apache-2.0
  eng.traineddata.gz                   @tesseract.js-data/eng@1.0.0
                                       4.0.0_best_int/                     MIT (package), Apache-2.0 (data)

The directory name carries the version because the language file's URL cannot be
stamped by asset(): to upgrade, add a new directory and change OCR_DIR in
lib/pantry-routes.js. test/nutrition.test.js checks SHA256SUMS.
