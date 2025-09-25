///////////////////////////////////////////////////////////
// Set current year
const yearEl = document.querySelector(".year");
const currentYear = new Date().getFullYear();
yearEl.textContent = currentYear;

///////////////////////////////////////////////////////////
// Make mobile navigation work

const btnNavEl = document.querySelector(".btn-mobile-nav");
const headerEl = document.querySelector(".header");

btnNavEl.addEventListener("click", function () {
  headerEl.classList.toggle("nav-open");
});

///////////////////////////////////////////////////////////
// Smooth scrolling animation

const allLinks = document.querySelectorAll("a:link");

allLinks.forEach(function (link) {
  link.addEventListener("click", function (e) {
    // e.preventDefault();
    const href = link.getAttribute("href");

    // Scroll back to top
    if (href === "#")
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

    // Scroll to other links
    if (href !== "#" && href.startsWith("#")) {
      const sectionEl = document.querySelector(href);
      sectionEl.scrollIntoView({ behavior: "smooth" });
    }

    // Close mobile naviagtion
    if (link.classList.contains("main-nav-link"))
      headerEl.classList.toggle("nav-open");
  });
});

///////////////////////////////////////////////////////////
// Sticky navigation

const sectionHeroEl = document.querySelector(".section-hero");

const obs = new IntersectionObserver(
  function (entries) {
    const ent = entries[0];
    console.log(ent);

    if (ent.isIntersecting === false) {
      document.body.classList.add("sticky");
    }

    if (ent.isIntersecting === true) {
      document.body.classList.remove("sticky");
    }
  },
  {
    // In the viewport
    root: null,
    threshold: 0,
    rootMargin: "-80px",
  }
);
obs.observe(sectionHeroEl);

//carosel
let list = document.querySelector(".carosel .list");
let items = document.querySelectorAll(".carosel .list .item");
let dots = document.querySelectorAll(".carosel .dots li");
let prev = document.getElementById("prev");
let next = document.getElementById("next");

let active = 0;
let lengthitems = items.length - 1;

next.onclick = function () {
  if (active + 1 > lengthitems) {
    active = 0;
  } else {
    active = active + 1;
  }
  reloadslider();
};

prev.onclick = function () {
  if (active - 1 < 0) {
    active = lengthitems;
  } else {
    active = active - 1;
  }
  reloadslider();
};

let autoslide = setInterval(() => {
  next.click();
}, 3000);

function reloadslider() {
  let checkleft = items[active].offsetLeft;
  list.style.left = -checkleft + "px";

  let lastactiveDot = document.querySelector(".carosel .dots li.active");
  if (lastactiveDot) lastactiveDot.classList.remove("active");
  dots[active].classList.add("active");
}

dots.forEach((li, key) => {
  li.addEventListener("click", function () {
    active = key;
    reloadslider();
  });
});
