var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var watchify = require('watchify');
var browserify = require('browserify');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var assign = require('lodash.assign');
var gutil = require('gulp-util');

gulp.task('browser-sync', function() {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });

  gulp.watch('./scss/*.scss', ['sass']).on('change', browserSync.reload);
  gulp.watch('./dist/index.html').on('change', browserSync.reload);
  gulp.watch('./scripts/*.js', ['js']).on('change', browserSync.reload);
});

gulp.task('sass', function() {
  gulp.src('./scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./dist'));
});

// gulp.task('compressjs', function() {
//   gulp.src('./scripts/*.js')
//     //.pipe(uglify())
//     .pipe(gulp.dest('./dist/scripts/'));
// });

// add custom browserify options here
// var customOpts = {
//   entries: ['./scripts/script.js'],
//   debug: true
// };
//var opts = assign({}, watchify.args, customOpts);
//var b = watchify(browserify(opts));
//b.on('update', bundle); // on any dep update, runs the bundler
gulp.task('js', function() {
  var b = browserify({
    entries: ['./scripts/script.js'],
    debug: true
  });

  return b.bundle()
    //.pipe(source('bundle.js'))
    // .pipe(sourcemaps.init({
    //   loadMaps: true
    // }))
    // // Add transformation tasks to the pipeline here.
    // .pipe(sourcemaps.write('./')) // writes .map file

    .pipe(source('./dist/scripts/bundle.js'))
    .pipe(buffer())
    // .pipe(sourcemaps.init({
    //   loadMaps: true
    // }))
    // .pipe(uglify())
    // .on('error', gutil.log)
    // .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./'));
});


gulp.task('default', ['js', 'browser-sync']);
