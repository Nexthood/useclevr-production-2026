
// You can test removing Next optional SWC packages only as smoke test.

// .pnpmfile.cjs
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "next") {
        delete pkg.optionalDependencies;
      }
      return pkg;
    },
  },
};
