<!-- File: src/views/Landing/JoinSection.vue -->

<script setup lang="ts">
// DEPS

// ASSETS
import DevsPhoto from '/assets/media/images/image1_867_26311.jpg'
import FrenchFlag from '@/components/svgs/icons/FrenchFlag.vue'
import { Send, SendIcon } from 'lucide-vue-next'
</script>

<template>
  <section id="join-section">
    <div class="container__xl">
      <div class="title">
        <h2>
          <FrenchFlag class="french-flag" /><span>Pas mal non ? <strong>C’est français !</strong></span></h2
        >
        <p>IndieHost est un projet indépendant. Nos investisseurs, <strong>c’est vous</strong>.</p>
      </div>

      <div class="main">
        <div class="content">
          <p> <strong>IndieHost</strong> est une solution imaginée <strong>avec des hôtes, pour des hôtes</strong>. Fait avec ❤️ entre la montagne, la mer et le Wi-Fi instable. </p>

          <p> Nous détestons le spam autant que vous, <strong>nous vous enverrons juste un e-mail</strong> pour vous tenir informé·e.</p>

          <div class="form-container">
            <h3><strong>Restez informé·e</strong></h3>

            <form>
              <input
                type="email"
                placeholder="Votre adresse e-mail"
                class="email-input"
                required
              />

              <fieldset>
                <legend>Je loue déjà sur...</legend>
                <div class="checkboxes-container">
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
                </div>
              </fieldset>

              <label class="checkbox">
                <input
                  type="checkbox"
                  required
                />
                Je veux être tenu·e informé·e du lancement et tester en avant-première
              </label>

              <div class="submit-btn">
                <button type="submit">
                  <span> Envoyer </span>
                  <SendIcon
                    class="send-icon"
                    :size="16"
                  />
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="illustration">
          <img
            :src="DevsPhoto"
            alt="Photo des développeurs IndieHost"
            class="image"
          />
        </div>
      </div>
    </div>
  </section>
</template>
