<!-- File: src/views/Landing/WhySection/BenefitsSection.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';

const nights = ref(6);
const price = ref(130);
const total = computed(() => {
    return nights.value * price.value;
});
const commissions = computed(() => {
    return Math.ceil(total.value * 0.2);
});


</script>

<template>
    <section id="benefits-section">
        <div class="container">
            <h1>
                Votre logement pourrait vous
                rapporter <span class="gradient-text">{{ commissions }} €</span> de <span
                    class="gradient-text">plus</span>
            </h1>
            <p>
                <span>
                    {{ nights }}
                    <input type="number" v-model="nights" />
                </span>
                nuits |
                <span>
                    {{ price }}
                    <input type="number" v-model="price" />
                </span>
                €/nuit
            </p>
        </div>

        <div class="illustration">
            <div class="ih-price">
                <div>
                    <p>
                        {{ total }} €
                    </p>
                    <div class="gains">
                        <p>
                            - 0 €
                        </p>
                    </div>
                </div>
            </div>
            <div class="ota-price">
                <div>
                    <div class="losses">
                        <p>
                            - {{ commissions }} €
                        </p>
                    </div>
                    <div class="ota-total">
                        <p>
                            {{ total }} €
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>