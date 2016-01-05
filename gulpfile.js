var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var ghPages = require('gulp-gh-pages');


gulp.task('browser-sync', function() {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });

  gulp.watch('./scss/*.scss', ['sass']).on('change', browserSync.reload);
  gulp.watch('./dist/index.html').on('change', browserSync.reload);
  gulp.watch('./scripts/*.js', ['compressjs']).on('change', browserSync.reload);
});

gulp.task('sass', function() {
  gulp.src('./scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./dist'));
});

gulp.task('compressjs', function() {
  gulp.src('./scripts/*.js')
  //.pipe(uglify())
  .pipe(gulp.dest('./dist/scripts/'));
});

gulp.task('deploy', function() {
  return gulp.src('./dist/**/*')
    .pipe(ghPages());
});

gulp.task('default', ['browser-sync']);
