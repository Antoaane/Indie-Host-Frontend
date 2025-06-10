<!-- File: src/views/Landing/StrengthsSection.vue -->

<script setup lang="ts">
// DEPS

// ASSETS
import Compass from '@/components/svgs/icons/Compass.vue'
import Handshake from '@/components/svgs/icons/Handshake.vue'
import MagicStick from '@/components/svgs/icons/MagicStick.vue'
</script>

<template>
  <section id="strengths-section">
    <div class="container">
      <div class="title">
        <h2> Une meilleure façon <strong>d’accueillir</strong></h2>
        <p>
          Nous croyons que louer son logement ne devrait pas rimer avec commissions excessives, outils compliqués ou dépendance totale aux plateformes. Nous proposons une <strong>simple, directe et personnelle</strong> qui redonne le contrôle à celles et ceux qui font vivre l’hospitalité. <br /><br />
          Pas besoin d’être expert. Pas besoin de tout quitter. <strong>Juste l’envie de reprendre la main</strong>.
        </p>
      </div>
      <div class="strengths">
        <div>
          <Compass
            class="strength-icon"
            title="Liberté"
            desc="Icone symbolisant la liberté et l'autonomie."
          />
          <h3>Liberté</h3>
          <p> Fixez vos tarifs, vos règles, vos conditions. Façonnez votre annonce à votre image et faites-en profiter vos voyageurs. </p>
        </div>
        <div>
          <MagicStick
            class="strength-icon"
            title="Simplicité"
            desc="Icone symbolisant la simplicité et rapidité d'utilisation."
          />
          <h3>Simplicité</h3>
          <p> Pas besoin de se faire la main. Vous créez votre annonce en un clic, puis vous avez le champ libre pour vous occuper de vos hôtes. </p>
        </div>
        <div>
          <Handshake
            class="strength-icon"
            title="Lien humain"
            desc="Icone symbolisant le lien humain et l'échange."
          />
          <h3>Lien humain</h3>
          <p> Vous êtes le seul à connaître votre logement. Quand la réservation est directe, la relation l’est aussi. Créez de la fidélité </p>
        </div>
      </div>
    </div>
  </section>
</template>
