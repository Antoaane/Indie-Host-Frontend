<!-- File: src/views/Landing/JoinSection.vue -->

<script setup lang="ts">
// DEPS

// ASSETS
import DevsPhoto from '@/assets/media/images/image1_867_26311.jpg'
import FrenchFlag from '@/components/svgs/icons/FrenchFlag.vue'
</script>

<template>
  <section id="support-section">
    <div class="container__xl">
      <div class="content">
        <div class="title">
          <h2> <FrenchFlag class="french-flag" /> Pas mal non ? <span class="gradient-text">C’est français !</span> </h2>
          <p>IndieHost est un projet indépendant. Nos investisseurs, c’est vous.</p>
        </div>

        <div class="intro">
          <div class="text">
            <p> <strong>IndieHost</strong> est une solution imaginée <strong>avec des hôtes, pour des hôtes</strong>. Fait avec ❤️ entre la montagne, la mer et le Wi-Fi instable. </p>

            <blockquote> Nous détestons le spam autant que vous, <strong>nous vous enverrons juste un e-mail</strong> pour vous tenir informé <em>et peut-être essayer le projet gratuitement !</em> </blockquote>
          </div>

          <img
            :src="DevsPhoto"
            alt="Photo des développeurs IndieHost"
            class="image"
          />
        </div>

        <h3 class="cta-title">👉 <strong>Tenez-moi informé</strong></h3>

        <form class="interest-form">
          <input
            type="email"
            placeholder="Votre adresse e-mail"
            class="email-input"
            required
          />

          <fieldset>
            <legend>Je loue déjà sur...</legend>
            <label
              ><input
                type="checkbox"
                name="platforms"
                value="airbnb"
              />
              Airbnb</label
            >
            <label
              ><input
                type="checkbox"
                name="platforms"
                value="booking"
              />
              Booking</label
            >
            <label
              ><input
                type="checkbox"
                name="platforms"
                value="autre"
              />
              Autre</label
            >
            <label
              ><input
                type="checkbox"
                name="platforms"
                value="debutant"
              />
              Je débute</label
            >
          </fieldset>

          <label class="checkbox">
            <input
              type="checkbox"
              required
            />
            Je veux être tenu·e informé·e du lancement et tester en avant-première
          </label>

          <div class="submit-btn">
            <button type="submit">Envoyer</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
