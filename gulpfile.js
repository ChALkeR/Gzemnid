'use strict';

const gulp = require('gulp');
const changed = require('gulp-changed');
const plumber = require('gulp-plumber');
const babel = require('gulp-babel');

const files = {
  libs: ['libs/**/*.js']
};

gulp.task('libs', () =>
  gulp.src(files.libs)
    .pipe(plumber())
    .pipe(changed('build'))
    .pipe(babel())
    .pipe(gulp.dest('build'))
);

gulp.task('build', ['libs']);

gulp.task('watch', ['build'], () => {
  gulp.watch(files.libs, ['libs']);
});
